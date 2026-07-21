/**
 * Idempotent cleanup of any leftover data created by verify-contracts.ts.
 * Removes workspaces/organisations named 'Verify A'/'Verify B' (cascades) and
 * auth users matching verify-[ab]-<n>@example.test.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/cleanup-verify.ts
 */
import { sql } from "drizzle-orm";
import { adminDb } from "../src/server/db";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  // Public schema: delete workspaces first (cascades children), then orgs.
  await adminDb.execute(
    sql`delete from public.workspaces where name in ('Verify A','Verify B')`,
  );
  await adminDb.execute(
    sql`delete from public.organisations where name in ('Verify A','Verify B')`,
  );
  console.log("public: removed Verify A/B workspaces + organisations");

  // Auth users via admin API.
  const h = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=500`, {
    headers: h,
  });
  const body = (await res.json()) as {
    users?: Array<{ id: string; email?: string }>;
  };
  const users = (body.users ?? []).filter((u) =>
    /^verify-[ab]-\d+@example\.test$/.test(u.email ?? ""),
  );
  for (const u of users) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${u.id}`, {
      method: "DELETE",
      headers: h,
    });
    console.log(`auth: deleted ${u.email}`);
  }
  console.log(`done (${users.length} user(s) removed)`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
