/**
 * Verifies the product-event pipeline + usage analytics (platform admin):
 *  - trackEvent records events and never throws;
 *  - getUsageAnalytics reflects new events: DAU, today's bucket, top actions,
 *    active workspaces (7d);
 *  - a user active this week AND the prior week counts as returning.
 *
 * Uses synthetic user/workspace ids (events have no FK). Cleans up its own rows.
 * Run: set -a; source .env.local; set +a; ./node_modules/.bin/tsx scripts/verify-events.ts
 */
import { randomUUID } from "crypto";
import { eq, like, or } from "drizzle-orm";
import { adminDb } from "../src/server/db";
import { platformEvents } from "../src/server/db/schema";
import {
  getUsageAnalytics,
  recordHeartbeat,
  trackEvent,
} from "../src/server/services/events";

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean) => {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  cond ? pass++ : fail++;
};

async function main() {
  const stamp = Date.now();
  const eventName = `verify.event.${stamp}`;
  const userNew = randomUUID();
  const userReturning = randomUUID();
  const heartbeatUser = randomUUID();
  const wsId = randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  try {
    const before = await getUsageAnalytics();

    // A brand-new user fires several events today.
    await trackEvent({ name: eventName, userId: userNew, workspaceId: wsId });
    await trackEvent({ name: eventName, userId: userNew, workspaceId: wsId });
    // A returning user: one event today + one 10 days ago (prior week).
    await trackEvent({
      name: eventName,
      userId: userReturning,
      workspaceId: wsId,
    });
    await adminDb.insert(platformEvents).values({
      name: eventName,
      userId: userReturning,
      workspaceId: wsId,
      createdAt: new Date(Date.now() - 10 * 86_400_000),
    });

    // trackEvent must not throw even with everything null.
    let threw = false;
    try {
      await trackEvent({ name: `${eventName}.nulls` });
    } catch {
      threw = true;
    }
    check("trackEvent never throws (best-effort)", threw === false);

    const after = await getUsageAnalytics();

    check(
      "DAU grows with the two new active users",
      after.activeUsers.dau >= before.activeUsers.dau + 2,
    );
    check(
      "WAU + MAU also reflect the new users",
      after.activeUsers.wau >= before.activeUsers.wau + 2 &&
        after.activeUsers.mau >= before.activeUsers.mau + 2,
    );
    check(
      "active workspaces (7d) includes the new workspace",
      after.activeWorkspaces7d >= before.activeWorkspaces7d + 1,
    );
    check(
      "the returning user is counted (active this week + prior week)",
      after.returningUsers7d >= before.returningUsers7d + 1,
    );
    check(
      "today's bucket appears in the 30-day event trend",
      after.eventsByDay.some((d) => d.day === today && d.count >= 3),
    );
    check(
      "the event name appears in top actions",
      after.topEvents.some((e) => e.name === eventName && e.count >= 3),
    );
    check(
      "total 30-day events increased",
      after.totalEvents30d >= before.totalEvents30d + 3,
    );

    // --- Session heartbeat (true active-user coverage) ----------------------
    const beforeHb = await getUsageAnalytics();
    const first = await recordHeartbeat(heartbeatUser, wsId);
    const second = await recordHeartbeat(heartbeatUser, wsId);
    check(
      "first heartbeat records, second is throttled",
      first.throttled === false && second.throttled === true,
    );
    const afterHb = await getUsageAnalytics();
    check(
      "heartbeat makes the user count as active (DAU)",
      afterHb.activeUsers.dau >= beforeHb.activeUsers.dau + 1,
    );
    check(
      "throttle keeps it to a single event (not two)",
      afterHb.totalEvents30d === beforeHb.totalEvents30d + 1,
    );
    check(
      "heartbeats are excluded from top actions",
      !afterHb.topEvents.some((e) => e.name === "session.active"),
    );
  } finally {
    console.log("Cleanup…");
    try {
      await adminDb
        .delete(platformEvents)
        .where(
          or(
            like(platformEvents.name, `verify.event.${stamp}%`),
            eq(platformEvents.userId, heartbeatUser),
          ),
        );
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
