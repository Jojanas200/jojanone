import { desc, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { jovaMemories } from "../db/schema";
import { getEmbedder, toVectorLiteral, type Embedder } from "../ai/embedder";
import { getBusinessProfile } from "./settings";
import { getOnboarding } from "./onboarding";
import { ALL_FIELDS } from "../../shared/onboarding/logic";
import type {
  FieldDef,
  JsonValue,
  OnboardingAnswers,
} from "../../shared/onboarding/types";

/**
 * Jova long-term memory. Facts and interactions are stored with a vector
 * embedding and recalled by semantic similarity. Everything runs through
 * withUser() (RLS), so recall can only ever surface the caller's own
 * workspace's memories. Writes degrade gracefully when no embedder is
 * available (the row is stored without an embedding and simply isn't recalled).
 */

export interface MemoryInput {
  kind?: string;
  title?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  sourceModule?: string | null;
  refId?: string | null;
}

export interface RecalledMemory {
  id: string;
  kind: string;
  title: string | null;
  content: string;
  sourceModule: string | null;
  similarity: number;
}

export async function remember(
  claims: UserClaims,
  workspaceId: string,
  mem: MemoryInput,
  embedder: Embedder = getEmbedder(),
): Promise<string | null> {
  let embedding: number[] | null = null;
  if (await embedder.isAvailable()) {
    try {
      embedding = (await embedder.embed([mem.content]))[0] ?? null;
    } catch {
      embedding = null;
    }
  }
  const vecLit = embedding ? toVectorLiteral(embedding) : null;

  return withUser(claims, async (tx) => {
    const rows = (await tx.execute(sql`
      insert into jova_memories
        (workspace_id, kind, title, content, embedding, metadata,
         source_module, ref_id, created_by)
      values
        (${workspaceId}, ${mem.kind ?? "fact"}, ${mem.title ?? null},
         ${mem.content}, ${vecLit}::vector,
         ${JSON.stringify(mem.metadata ?? {})}::jsonb,
         ${mem.sourceModule ?? null}, ${mem.refId ?? null}, ${claims.sub})
      returning id
    `)) as unknown as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  });
}

/** Semantic recall of the caller's workspace memories, most similar first. */
export async function recall(
  claims: UserClaims,
  query: string,
  opts?: {
    k?: number;
    embedder?: Embedder;
    minSimilarity?: number;
    workspaceId?: string;
  },
): Promise<RecalledMemory[]> {
  const embedder = opts?.embedder ?? getEmbedder();
  if (!query.trim() || !(await embedder.isAvailable())) return [];

  let qvec: number[] | null = null;
  try {
    qvec = (await embedder.embed([query]))[0] ?? null;
  } catch {
    return [];
  }
  if (!qvec) return [];

  const lit = toVectorLiteral(qvec);
  const k = Math.min(Math.max(opts?.k ?? 5, 1), 20);
  const min = opts?.minSimilarity ?? 0;
  // Optional narrowing to a single workspace (RLS already limits to the
  // caller's own workspaces; this scopes to the active one).
  const wsFilter = opts?.workspaceId
    ? sql`and workspace_id = ${opts.workspaceId}`
    : sql``;

  return withUser(claims, async (tx) => {
    const rows = (await tx.execute(sql`
      select id, kind, title, content, source_module,
             1 - (embedding <=> ${lit}::vector) as similarity
      from jova_memories
      where embedding is not null ${wsFilter}
      order by embedding <=> ${lit}::vector
      limit ${k}
    `)) as unknown as Array<{
      id: string;
      kind: string;
      title: string | null;
      content: string;
      source_module: string | null;
      similarity: number | string;
    }>;
    return rows
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        content: r.content,
        sourceModule: r.source_module,
        similarity: Number(r.similarity),
      }))
      .filter((r) => r.similarity >= min);
  });
}

export function listMemories(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx.select().from(jovaMemories).orderBy(desc(jovaMemories.createdAt)),
  );
}

export function deleteWorkspaceMemories(
  claims: UserClaims,
  workspaceId: string,
  kinds?: string[],
) {
  return withUser(claims, async (tx) => {
    if (kinds && kinds.length) {
      const list = sql.join(
        kinds.map((k) => sql`${k}`),
        sql`, `,
      );
      await tx.execute(sql`
        delete from jova_memories
        where workspace_id = ${workspaceId} and kind in (${list})
      `);
    } else {
      await tx.execute(sql`
        delete from jova_memories where workspace_id = ${workspaceId}
      `);
    }
  });
}

// --- Building baseline memory from the workspace's own facts -----------------
const READABLE_EXCLUDED = new Set([
  "password",
  "consent",
  "file",
  "people_list",
  "team_invites",
]);

function answerToText(
  field: FieldDef,
  value: JsonValue | undefined,
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (field.type === "multiselect") {
    if (!Array.isArray(value) || value.length === 0) return null;
    return value
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  if (field.type === "select")
    return (
      field.options?.find((o) => o.value === value)?.label ?? String(value)
    );
  if (field.type === "boolean")
    return value === true ? "Yes" : value === false ? "No" : null;
  if (field.type === "yesno_unsure")
    return typeof value === "string"
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : null;
  return String(value);
}

function buildMemoryDocs(
  profile: Awaited<ReturnType<typeof getBusinessProfile>>,
  answers: OnboardingAnswers,
): MemoryInput[] {
  const docs: MemoryInput[] = [];

  if (profile) {
    const parts: string[] = [];
    if (profile.businessName?.trim())
      parts.push(`Business name: ${profile.businessName.trim()}`);
    if (profile.businessType) parts.push(`Structure: ${profile.businessType}`);
    if (profile.industry) parts.push(`Industry: ${profile.industry}`);
    if (profile.companyNumber)
      parts.push(`Company number: ${profile.companyNumber}`);
    parts.push(
      `Employees: ${profile.employeeCount}, contractors: ${profile.contractorCount}`,
    );
    if (profile.annualRevenueBand)
      parts.push(`Revenue band: ${profile.annualRevenueBand}`);
    parts.push(`VAT registered: ${profile.vatRegistered ? "yes" : "no"}`);
    parts.push(`Employs staff: ${profile.employerRegistered ? "yes" : "no"}`);
    parts.push(
      `Processes personal data: ${profile.processesPersonalData ? "yes" : "no"}`,
    );
    parts.push(
      `Trades internationally: ${profile.tradesInternationally ? "yes" : "no"}`,
    );
    if (parts.length)
      docs.push({
        kind: "profile",
        title: "Business profile",
        content: `${parts.join(". ")}.`,
        sourceModule: "profile",
      });
  }

  const lines: string[] = [];
  for (const f of ALL_FIELDS) {
    if (READABLE_EXCLUDED.has(f.type)) continue;
    const t = answerToText(f, answers[f.id]);
    if (t) lines.push(`${f.label}: ${t}`);
  }
  if (lines.length)
    docs.push({
      kind: "onboarding",
      title: "Onboarding answers",
      content: `${lines.join(". ")}.`,
      sourceModule: "profile",
    });

  return docs;
}

/**
 * Refresh the workspace's baseline memory (business profile + onboarding facts)
 * so Jova "recognises" the business. Idempotent: replaces prior profile/
 * onboarding memories. No-op when no embedder is available. Returns the count.
 */
export async function syncWorkspaceMemory(
  claims: UserClaims,
  workspaceId: string,
  embedder: Embedder = getEmbedder(),
): Promise<number> {
  if (!(await embedder.isAvailable())) return 0;
  const [profile, onboarding] = await Promise.all([
    getBusinessProfile(claims, workspaceId),
    getOnboarding(claims, workspaceId),
  ]);
  const docs = buildMemoryDocs(profile, onboarding.answers);
  if (!docs.length) return 0;

  await deleteWorkspaceMemories(claims, workspaceId, ["profile", "onboarding"]);
  for (const d of docs) await remember(claims, workspaceId, d, embedder);
  return docs.length;
}
