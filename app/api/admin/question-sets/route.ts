import { NextResponse } from "next/server";
import {
  logPlatformAction,
  requirePlatformAdmin,
} from "@/server/services/platform-admin";
import {
  getQuestionSet,
  isQuestionSetOverridden,
  listQuestionSets,
  resetQuestionSet,
  saveQuestionSet,
} from "@/server/services/question-sets";

// Platform-managed questionnaires. GET lists every editable set with its
// current (override-or-default) items; PUT stores an override; DELETE removes
// it so the set falls back to the code default. Operator tier for writes.

export async function GET() {
  await requirePlatformAdmin();
  const metas = listQuestionSets();
  const sets = await Promise.all(
    metas.map(async (meta) => ({
      ...meta,
      items: await getQuestionSet(meta.key),
      overridden: await isQuestionSetOverridden(meta.key),
    })),
  );
  return NextResponse.json({ sets });
}

export async function PUT(req: Request) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const body = (await req.json().catch(() => null)) as {
    key?: string;
    questions?: unknown;
  } | null;
  if (!body?.key || !Array.isArray(body.questions))
    return NextResponse.json(
      { error: "key and questions[] required" },
      { status: 400 },
    );
  const result = await saveQuestionSet(
    body.key,
    body.questions,
    actor.email ?? "unknown",
  );
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });
  await logPlatformAction(actor, "question_set.updated", {
    detail: { key: body.key, count: result.items.length },
  });
  return NextResponse.json({ ok: true, items: result.items });
}

export async function DELETE(req: Request) {
  const actor = await requirePlatformAdmin();
  if (actor.role !== "operator")
    return NextResponse.json(
      { error: "Read-only access - operator tier required." },
      { status: 403 },
    );
  const key = new URL(req.url).searchParams.get("key");
  if (!key)
    return NextResponse.json({ error: "key required" }, { status: 400 });
  const removed = await resetQuestionSet(key);
  if (removed)
    await logPlatformAction(actor, "question_set.reset", { detail: { key } });
  return NextResponse.json({ ok: true, removed });
}
