/**
 * Verifies the two-tier platform-admin model:
 *  - PLATFORM_ADMIN_EMAILS  => "operator" (full access);
 *  - PLATFORM_ANALYST_EMAILS => "analyst" (read-only);
 *  - operator wins if listed in both; unknown => no access; case-insensitive.
 *
 * Run: ./node_modules/.bin/tsx scripts/verify-platform-tiers.ts
 */
import {
  getPlatformRole,
  isPlatformAdmin,
  isPlatformOperator,
} from "../src/server/services/platform-admin";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

function main() {
  const savedOps = process.env.PLATFORM_ADMIN_EMAILS;
  const savedAn = process.env.PLATFORM_ANALYST_EMAILS;
  try {
    process.env.PLATFORM_ADMIN_EMAILS = "op@jojan.one, both@jojan.one";
    process.env.PLATFORM_ANALYST_EMAILS = "analyst@jojan.one, both@jojan.one";

    check(
      "operator email is operator",
      getPlatformRole("op@jojan.one") === "operator",
    );
    check(
      "analyst email is analyst",
      getPlatformRole("analyst@jojan.one") === "analyst",
    );
    check(
      "operator wins when listed in both tiers",
      getPlatformRole("both@jojan.one") === "operator",
    );
    check("unknown email has no role", getPlatformRole("nobody@x.co") === null);
    check("null email has no role", getPlatformRole(null) === null);
    check(
      "role check is case-insensitive",
      getPlatformRole("OP@Jojan.One") === "operator",
    );

    check("operator is a platform admin", isPlatformAdmin("op@jojan.one"));
    check(
      "analyst is also a platform admin",
      isPlatformAdmin("analyst@jojan.one"),
    );
    check(
      "only operators are operators",
      isPlatformOperator("op@jojan.one") === true &&
        isPlatformOperator("analyst@jojan.one") === false,
    );

    delete process.env.PLATFORM_ANALYST_EMAILS;
    check(
      "with no analyst list, analysts lose access",
      getPlatformRole("analyst@jojan.one") === null,
    );
  } finally {
    if (savedOps === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = savedOps;
    if (savedAn === undefined) delete process.env.PLATFORM_ANALYST_EMAILS;
    else process.env.PLATFORM_ANALYST_EMAILS = savedAn;
  }

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
