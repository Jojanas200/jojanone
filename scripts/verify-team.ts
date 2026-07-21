/**
 * Verifies the email layer + email-dependent features (M6 follow-on):
 *  - pluggable email provider (console/mock, build-now-key-later)
 *  - reminder email digests (mock transport + mock email lookup)
 *  - member-invite lifecycle: seat-enforced create, email-bound + single-use
 *    accept, accept-time seat enforcement, revoke, and tenant scoping.
 *
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-team.ts
 */
import { and, eq, inArray } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import {
  memberships,
  notifications,
  organisations,
  subscriptions,
  workspaces,
} from "../src/server/db/schema";
import {
  acceptInvitation,
  createInvitation,
  listPendingInvitations,
  revokeInvitation,
} from "../src/server/services/invitations";
import {
  getWorkspaceAccess,
  getWorkspaceRole,
  isModuleAllowed,
} from "../src/server/services/workspaces";
import {
  getEmailProvider,
  isEmailConfigured,
  sendEmail,
  type EmailMessage,
  type EmailProvider,
} from "../src/server/email/provider";
import { sendReminderDigests } from "../src/server/email/digests";
import { provisionWorkspace } from "../src/server/services/provisioning";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

class MockEmail implements EmailProvider {
  readonly name = "mock";
  sent: EmailMessage[] = [];
  isConfigured() {
    return true;
  }
  async send(msg: EmailMessage) {
    this.sent.push(msg);
    return { ok: true, id: "mock" };
  }
}

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
const setSeats = (workspaceId: string, seats: number, plan = "growth") =>
  adminDb
    .update(subscriptions)
    .set({ seatsAllowed: seats, planKey: plan })
    .where(eq(subscriptions.workspaceId, workspaceId));

async function main() {
  const stamp = Date.now();
  const emailA = `team-a-${stamp}@example.test`;
  const emailC = `team-c-${stamp}@example.test`;
  const emailD = `team-d-${stamp}@example.test`;
  let userA = "";
  let userB = "";
  let userC = "";
  let userD = "";
  let wsA = "";
  let wsB = "";
  const savedEmailProvider = process.env.EMAIL_PROVIDER;
  const savedResendKey = process.env.RESEND_API_KEY;

  try {
    // --- Email provider ------------------------------------------------------
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_PROVIDER = "resend";
    check("resend with no key → not configured", isEmailConfigured() === false);
    process.env.EMAIL_PROVIDER = "console";
    check(
      "console provider is always configured (dev)",
      getEmailProvider().isConfigured(),
    );
    const consoleSend = await sendEmail({
      to: "x@y.z",
      subject: "hi",
      html: "<p>hi</p>",
    });
    check("console provider sends ok", consoleSend.ok);
    process.env.EMAIL_PROVIDER = savedEmailProvider ?? "resend";

    userA = await createUser(emailA);
    userB = await createUser(`team-b-${stamp}@example.test`);
    userC = await createUser(emailC);
    userD = await createUser(emailD);
    wsA = await provisionWorkspace(
      { sub: userA },
      { orgName: "Team A", workspaceName: "Team A" },
    );
    wsB = await provisionWorkspace(
      { sub: userB },
      { orgName: "Team B", workspaceName: "Team B" },
    );

    // --- Invites: seat enforcement at create --------------------------------
    const blocked = await createInvitation({ sub: userA }, wsA, {
      email: emailC,
      role: "team_member",
    });
    check("invite blocked on Starter (no free seat)", blocked.ok === false);

    await setSeats(wsA, 5); // upgrade to Growth
    const inv = await createInvitation({ sub: userA }, wsA, {
      email: emailC,
      role: "team_member",
    });
    check("invite created once a seat is free", inv.ok === true);
    const token = inv.ok ? inv.result.token : "";

    check(
      "invite is listed as pending",
      (await listPendingInvitations({ sub: userA }, wsA)).length === 1,
    );

    // --- Non-owner cannot invite into A's workspace -------------------------
    const foreign = await createInvitation({ sub: userB }, wsA, {
      email: emailD,
      role: "team_member",
    });
    check(
      "non-owner cannot invite into another workspace",
      foreign.ok === false,
    );

    // --- Accept: email must match -------------------------------------------
    const wrongEmail = await acceptInvitation(
      userC,
      "someone-else@example.test",
      token,
    );
    check("accept rejected when email doesn't match", wrongEmail.ok === false);

    // --- Accept: success creates membership ---------------------------------
    const accepted = await acceptInvitation(userC, emailC, token);
    check("invitee accepts and joins the workspace", accepted.ok === true);
    check(
      "invitee now has the granted role",
      (await getWorkspaceRole({ sub: userC }, wsA)) === "team_member",
    );

    // --- Accept: single-use --------------------------------------------------
    const reuse = await acceptInvitation(userC, emailC, token);
    check("token is single-use (already used)", reuse.ok === false);

    // --- Accept-time seat enforcement ---------------------------------------
    const inv2 = await createInvitation({ sub: userA }, wsA, {
      email: emailD,
      role: "team_member",
    });
    const token2 = inv2.ok ? inv2.result.token : "";
    await setSeats(wsA, 2); // now full: owner + C = 2 used
    const noSeat = await acceptInvitation(userD, emailD, token2);
    check(
      "accept is blocked when the workspace is at its seat limit",
      noSeat.ok === false,
    );

    // --- Revoke --------------------------------------------------------------
    await setSeats(wsA, 5);
    const inv3 = await createInvitation({ sub: userA }, wsA, {
      email: `team-e-${stamp}@example.test`,
      role: "read_only",
    });
    const inv3Id = inv3.ok ? inv3.result.id : "";
    check(
      "owner can revoke a pending invite",
      (await revokeInvitation({ sub: userA }, inv3Id)) === true,
    );

    // --- Adviser scope on invites -------------------------------------------
    await setSeats(wsA, 10);
    const byEmail = async (email: string) =>
      (await listPendingInvitations({ sub: userA }, wsA)).find(
        (i) => i.email === email.toLowerCase(),
      );

    // Non-adviser roles never carry a scope, even if one is supplied.
    const tmEmail = `team-tm-${stamp}@example.test`;
    await createInvitation({ sub: userA }, wsA, {
      email: tmEmail,
      role: "team_member",
      scopedModules: ["risk"],
    });
    check(
      "a scope on a non-adviser invite is ignored (null)",
      (await byEmail(tmEmail))?.scopedModules == null,
    );

    // An adviser with no modules selected keeps full (read-only) access.
    const advFullEmail = `team-advfull-${stamp}@example.test`;
    await createInvitation({ sub: userA }, wsA, {
      email: advFullEmail,
      role: "adviser",
      scopedModules: [],
    });
    check(
      "adviser with empty scope = full access (null)",
      (await byEmail(advFullEmail))?.scopedModules == null,
    );

    // A scoped adviser: unknown keys filtered; scope carried into membership.
    const advInv = await createInvitation({ sub: userA }, wsA, {
      email: emailD,
      role: "adviser",
      scopedModules: ["compliance", "risk", "not-a-real-module"],
    });
    // emailD also has an earlier team_member invite pending, so match on role.
    const advPending = (await listPendingInvitations({ sub: userA }, wsA)).find(
      (i) => i.email === emailD.toLowerCase() && i.role === "adviser",
    );
    check(
      "adviser invite stores only known modules",
      JSON.stringify(advPending?.scopedModules) ===
        JSON.stringify(["compliance", "risk"]),
    );

    const advToken = advInv.ok ? advInv.result.token : "";
    const advAccepted = await acceptInvitation(userD, emailD, advToken);
    check("scoped adviser accepts and joins", advAccepted.ok === true);

    const memberScope = (
      await adminDb
        .select({ s: memberships.scopedModules })
        .from(memberships)
        .where(
          and(eq(memberships.workspaceId, wsA), eq(memberships.userId, userD)),
        )
    )[0];
    check(
      "membership carries the adviser scope from the invite",
      JSON.stringify(memberScope?.s) === JSON.stringify(["compliance", "risk"]),
    );

    const advAccess = await getWorkspaceAccess({ sub: userD }, wsA);
    check(
      "scoped adviser is read-only",
      advAccess.role === "adviser" && advAccess.canWrite === false,
    );
    check(
      "in-scope module is allowed, out-of-scope is not",
      isModuleAllowed(advAccess.scopedModules, "compliance") === true &&
        isModuleAllowed(advAccess.scopedModules, "hr") === false,
    );

    // --- Reminder digest emails ---------------------------------------------
    const mock = new MockEmail();
    const lookup = async (uid: string) => (uid === userA ? emailA : null);
    // No unread notifications yet → nothing to send.
    const empty = await sendReminderDigests({
      emailProvider: mock,
      lookupEmail: lookup,
      onlyWorkspaceId: wsA,
    });
    check("no unread notifications → no digest sent", empty.sent === 0);

    await adminDb.insert(notifications).values({
      workspaceId: wsA,
      kind: "priority",
      title: "Confirmation statement due",
      description: "Due in 5 days.",
    });
    const digest = await sendReminderDigests({
      emailProvider: mock,
      lookupEmail: lookup,
      onlyWorkspaceId: wsA,
    });
    check(
      "digest emailed to the owner when unread items exist",
      digest.sent === 1,
    );
    check(
      "digest went to the owner's address with a subject",
      mock.sent.length === 1 &&
        mock.sent[0].to === emailA &&
        mock.sent[0].subject.length > 0,
    );
  } finally {
    if (savedEmailProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = savedEmailProvider;
    if (savedResendKey !== undefined)
      process.env.RESEND_API_KEY = savedResendKey;
    console.log("Cleanup…");
    try {
      const ids = [wsA, wsB].filter(Boolean);
      if (ids.length) {
        const orgRows = await adminDb
          .select({ org: workspaces.organisationId })
          .from(workspaces)
          .where(inArray(workspaces.id, ids));
        await adminDb.delete(workspaces).where(inArray(workspaces.id, ids));
        const orgIds = orgRows.map((x) => x.org).filter(Boolean);
        if (orgIds.length)
          await adminDb
            .delete(organisations)
            .where(inArray(organisations.id, orgIds));
      }
      for (const u of [userA, userB, userC, userD]) if (u) await deleteUser(u);
      void memberships;
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
