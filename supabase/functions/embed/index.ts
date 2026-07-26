// =============================================================================
// Supabase Edge Function: `embed`
// Text → 384-dim embeddings for Jova's memory, generated at the edge (Deno)
// using Supabase's built-in inference (gte-small). This keeps the heavy model
// off the Vercel serverless functions. gte-small is 384-dim, matching the
// jova_memories.embedding vector(384) column.
//
// This file is Deno code (not compiled by the app's tsc — it lives outside the
// tsconfig `include`). Deploy it with:  supabase functions deploy embed
//
// Request:  POST { "texts": ["...", "..."] }   (max 64, each truncated to 8k)
// Response: { "embeddings": number[][], "model": "gte-small", "dims": 384 }
//
// Auth: verify_jwt is on by default, so callers must present a valid Supabase
// JWT (the app calls it server-side with the service-role key).
// =============================================================================

// The edge runtime provides these globals; the app's TypeScript never sees this
// file, so the loose declarations just keep local editors quiet.
// deno-lint-ignore-file no-explicit-any
declare const Supabase: any;
declare const Deno: any;

const MODEL = "gte-small";
const MAX_TEXTS = 64;
const MAX_CHARS = 8000;

const session = new Supabase.ai.Session(MODEL);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { texts?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const texts = body.texts;
  if (!Array.isArray(texts) || texts.length === 0)
    return json({ error: "`texts` must be a non-empty array" }, 400);
  if (texts.length > MAX_TEXTS)
    return json({ error: `too many texts (max ${MAX_TEXTS})` }, 400);

  try {
    const embeddings: number[][] = [];
    for (const t of texts) {
      const out = await session.run(String(t).slice(0, MAX_CHARS), {
        mean_pool: true,
        normalize: true,
      });
      embeddings.push(Array.from(out as ArrayLike<number>));
    }
    return json({ embeddings, model: MODEL, dims: 384 });
  } catch (e) {
    return json({ error: `embedding failed: ${(e as Error).message}` }, 500);
  }
});
