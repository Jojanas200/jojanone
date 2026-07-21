/**
 * Verifies per-user theme preferences:
 *  - no row => getUserTheme returns null (browser keeps its own choice);
 *  - setUserTheme upserts and normalises unknown values to "default";
 *  - a user reads/writes only their own row (RLS self-access).
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-prefs.ts
 */
import { eq, inArray } from "drizzle-orm";
import { adminDb, withUser } from "../src/server/db";
import { userPreferences } from "../src/server/db/schema";
import { getUserTheme, setUserTheme } from "../src/server/services/prefs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function adminFetch(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE_URL}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}
async function createUser(email: string): Promise<string> {
  const res = await adminFetch("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password: "Test-Passw0rd!",
      email_confirm: true,
    }),
  });
  if (!res.ok) throw new Error(`createUser: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id?: string; user?: { id: string } };
  const id = data.id ?? data.user?.id;
  if (!id) throw new Error("createUser: no id");
  return id;
}
const deleteUser = (id: string) =>
  adminFetch(`/users/${id}`, { method: "DELETE" });

async function main() {
  const stamp = Date.now();
  let userA = "";
  let userB = "";

  try {
    userA = await createUser(`prefs-a-${stamp}@example.test`);
    userB = await createUser(`prefs-b-${stamp}@example.test`);

    check(
      "no saved pref returns null",
      (await getUserTheme({ sub: userA })) === null,
    );

    const saved = await setUserTheme({ sub: userA }, "neumorph");
    check(
      "setUserTheme saves and returns the theme",
      saved === "neumorph" &&
        (await getUserTheme({ sub: userA })) === "neumorph",
    );

    const norm = await setUserTheme({ sub: userA }, "not-a-theme");
    check(
      "an unknown theme normalises to default",
      norm === "default" && (await getUserTheme({ sub: userA })) === "default",
    );

    await setUserTheme({ sub: userA }, "dark");
    check("dark persists", (await getUserTheme({ sub: userA })) === "dark");

    // User B has no pref and cannot see A's row (RLS self-access).
    check(
      "another user sees no pref of their own",
      (await getUserTheme({ sub: userB })) === null,
    );
    const cross = await withUser({ sub: userB }, (tx) =>
      tx
        .select({ theme: userPreferences.theme })
        .from(userPreferences)
        .where(eq(userPreferences.userId, userA)),
    );
    check("a user cannot read another user's pref (RLS)", cross.length === 0);

    // B cannot overwrite A's row (RLS with-check); A's value is unchanged.
    const wrote = await withUser({ sub: userB }, (tx) =>
      tx
        .update(userPreferences)
        .set({ theme: "neumorph" })
        .where(eq(userPreferences.userId, userA))
        .returning({ id: userPreferences.userId }),
    );
    check(
      "a user cannot overwrite another user's pref (RLS)",
      wrote.length === 0 && (await getUserTheme({ sub: userA })) === "dark",
    );
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(userPreferences)
        .where(inArray(userPreferences.userId, [userA, userB].filter(Boolean)));
      for (const u of [userA, userB]) if (u) await deleteUser(u);
      console.log("  done");
    } catch (e) {
      console.log(`  cleanup warning: ${(e as Error).message}`);
    }
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
