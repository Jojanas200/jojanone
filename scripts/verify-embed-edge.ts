/**
 * Checks the deployed Supabase `embed` Edge Function end-to-end: 384-dim,
 * normalised vectors, and semantically-sensible similarity. Standalone (not in
 * the isolation chain) and SKIP-safe: if the function isn't deployed yet it
 * exits 0 with a note, so it never blocks anything.
 *
 * Run (after `supabase functions deploy embed`):
 *   set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-embed-edge.ts
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FN = process.env.JOVA_EMBED_FUNCTION ?? "embed";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

const dot = (a: number[], b: number[]) =>
  a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));

async function main() {
  const url = `${SUPABASE_URL}/functions/v1/${FN}`;
  const texts = [
    "The company is registered for VAT",
    "The business pays value added tax to HMRC",
    "Blue whales live in the deep ocean",
  ];

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ texts }),
    });
  } catch (e) {
    console.log(`SKIP: embed function unreachable (${(e as Error).message}).`);
    process.exit(0);
  }

  if (res.status === 404) {
    console.log(
      "SKIP: embed function not deployed. Run `supabase functions deploy embed`.",
    );
    process.exit(0);
  }
  if (!res.ok) {
    console.log(`FAIL: embed function returned ${res.status}`);
    console.log(await res.text().catch(() => ""));
    process.exit(1);
  }

  const data = (await res.json()) as {
    embeddings: number[][];
    dims?: number;
    model?: string;
  };
  const [v0, v1, v2] = data.embeddings ?? [];

  check("returns one vector per input", data.embeddings?.length === 3);
  check("vectors are 384-dim", v0?.length === 384 && v2?.length === 384);
  check("reports dims: 384", data.dims === 384);
  check("vectors are unit-normalised", Math.abs(norm(v0) - 1) < 0.02);
  check(
    "semantically similar texts are closer than unrelated ones",
    dot(v0, v1) > dot(v0, v2),
  );

  console.log(
    `\nResult: ${pass} passed, ${fail} failed (model: ${data.model})`,
  );
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
