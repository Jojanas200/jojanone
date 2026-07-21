import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { adminDb } from "../db/admin";
import { withUser, type UserClaims } from "../db";
import { invitations, memberships, subscriptions } from "../db/schema";
import { filterKnownModules } from "@/config/modules.config";
import { hasSeatAvailable } from "./billing";

// Normalise an adviser scope: keep only known module keys, dedupe. Returns null
// (= full access) for non-advisers or an empty selection.
function normaliseScope(
  role: string,
  scopedModules?: string[] | null,
): string[] | null {
  if (role !== "adviser") return null;
  return filterKnownModules(scopedModules);
}

// Team invitations. Owners create/list/revoke through withUser() (RLS restricts
// these to owner_admin). Acceptance runs with the service role (adminDb) because
// the invitee is not yet a member of the workspace - it validates the hashed
// token, enforces the seat limit, and creates the membership.

const EXPIRY_DAYS = 7;
const hashToken = (raw: string) =>
  createHash("sha256").update(raw).digest("hex");

export interface CreateInviteResult {
  id: string;
  email: string;
  token: string; // raw token - returned once, for the email link only
}

/** Create an invite (owner_admin, seat-enforced). Returns the raw token once. */
export async function createInvitation(
  claims: UserClaims,
  workspaceId: string,
  input: {
    email: string;
    role: "team_member" | "manager" | "read_only" | "adviser";
    scopedModules?: string[] | null;
  },
): Promise<
  { ok: true; result: CreateInviteResult } | { ok: false; error: string }
> {
  if (!(await hasSeatAvailable(claims, workspaceId)))
    return {
      ok: false,
      error: "No seats available on your plan. Upgrade to add a teammate.",
    };

  const email = input.email.trim().toLowerCase();
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 86_400_000);
  const scopedModules = normaliseScope(input.role, input.scopedModules);

  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(invitations)
      .values({
        workspaceId,
        email,
        role: input.role,
        scopedModules,
        tokenHash: hashToken(token),
        expiresAt,
        createdBy: claims.sub,
      })
      .returning({ id: invitations.id, email: invitations.email });
    return {
      ok: true as const,
      result: { id: rows[0].id, email: rows[0].email, token },
    };
  });
}

export function listPendingInvitations(
  claims: UserClaims,
  workspaceId: string,
) {
  return withUser(claims, (tx) =>
    tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        scopedModules: invitations.scopedModules,
        expiresAt: invitations.expiresAt,
        createdAt: invitations.createdAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspaceId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(invitations.createdAt),
  );
}

export function revokeInvitation(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(invitations)
      .where(eq(invitations.id, id))
      .returning({ id: invitations.id });
    return rows.length > 0;
  });
}

export type AcceptResult =
  { ok: true; workspaceId: string } | { ok: false; error: string };

/**
 * Accept an invite (service role). Validates token/expiry/email, enforces the
 * seat limit, and creates the membership. Idempotent-ish: a second accept after
 * the invite is consumed returns "already used".
 */
export async function acceptInvitation(
  userId: string,
  userEmail: string | null,
  rawToken: string,
): Promise<AcceptResult> {
  const inv = (
    await adminDb
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hashToken(rawToken)))
      .limit(1)
  )[0];
  if (!inv) return { ok: false, error: "This invitation link is invalid." };
  if (inv.acceptedAt)
    return { ok: false, error: "This invitation has already been used." };
  if (new Date(inv.expiresAt).getTime() < Date.now())
    return { ok: false, error: "This invitation has expired." };
  if (
    !userEmail ||
    userEmail.trim().toLowerCase() !== inv.email.trim().toLowerCase()
  )
    return {
      ok: false,
      error: "Sign in with the email address the invitation was sent to.",
    };

  // Already a member? Consume the invite, no-op the membership.
  const existing = (
    await adminDb
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.workspaceId, inv.workspaceId),
          eq(memberships.userId, userId),
        ),
      )
      .limit(1)
  )[0];

  if (!existing) {
    // Enforce the seat limit at acceptance time (service-role count).
    const sub = (
      await adminDb
        .select({ seats: subscriptions.seatsAllowed })
        .from(subscriptions)
        .where(eq(subscriptions.workspaceId, inv.workspaceId))
        .limit(1)
    )[0];
    const used = Number(
      (
        await adminDb
          .select({ n: sql<number>`count(*)` })
          .from(memberships)
          .where(eq(memberships.workspaceId, inv.workspaceId))
      )[0]?.n ?? 0,
    );
    if (sub && used >= sub.seats)
      return {
        ok: false,
        error:
          "This workspace has no seats available. Ask the owner to upgrade.",
      };

    await adminDb.insert(memberships).values({
      workspaceId: inv.workspaceId,
      userId,
      role: inv.role,
      scopedModules: inv.scopedModules,
      invitedBy: inv.createdBy,
    });
  }

  await adminDb
    .update(invitations)
    .set({ acceptedAt: new Date(), updatedAt: new Date() })
    .where(eq(invitations.id, inv.id));

  return { ok: true, workspaceId: inv.workspaceId };
}
