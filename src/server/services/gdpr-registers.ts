import { desc, eq, sql } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  dataBreaches,
  dataRequests,
  dpias,
  gdprAssessments,
  privacyNotices,
} from "../db/schema";
import { recordActivity } from "./activity";
import {
  deriveGdprFindings,
  type GdprAnswer,
  type CreateDataBreachInput,
  type CreateDataRequestInput,
  type CreateDpiaInput,
  type CreatePrivacyNoticeInput,
  type UpdateDataBreachInput,
  type UpdateDataRequestInput,
  type UpdateDpiaInput,
  type UpdatePrivacyNoticeInput,
} from "../../shared/schemas/gdpr-registers";

// GDPR operational sub-registers: data subject requests (DSARs), data breaches
// and DPIAs. Every function runs through withUser() so RLS decides visibility
// and write access. updated_at is maintained by a DB trigger.

const REQUEST_LABEL: Record<string, string> = {
  subject_access: "Subject access",
  rectification: "Rectification",
  erasure: "Erasure",
  restriction: "Restriction",
  objection: "Objection",
  portability: "Portability",
};

// DSAR statutory clock: one calendar month from the received date.
function plusOneMonth(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}
const toTs = (iso?: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`) : null;

// --- Data subject requests (DSARs) ------------------------------------------
export function listDataRequests(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(dataRequests)
      .orderBy(sql`${dataRequests.dueDate} asc nulls last`),
  );
}

export function createDataRequest(
  claims: UserClaims,
  workspaceId: string,
  input: CreateDataRequestInput,
) {
  return withUser(claims, async (tx) => {
    const dueDate = input.dueDate ?? plusOneMonth(input.receivedDate);
    const rows = await tx
      .insert(dataRequests)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        requestType: input.requestType,
        requesterReference: input.requesterReference ?? null,
        receivedDate: input.receivedDate,
        dueDate,
        identityVerified: input.identityVerified,
        status: input.status,
        assignedOwner: input.assignedOwner ?? null,
        notes: input.notes ?? null,
        completedAt: input.status === "completed" ? sql`now()` : null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "created",
      title: `${REQUEST_LABEL[input.requestType] ?? "Data"} request`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateDataRequest(
  claims: UserClaims,
  id: string,
  input: UpdateDataRequestInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(dataRequests)
      .set({
        ...input,
        updatedBy: claims.sub,
        ...(input.status
          ? { completedAt: input.status === "completed" ? sql`now()` : null }
          : {}),
      })
      .where(eq(dataRequests.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "gdpr",
        action: input.status === "completed" ? "completed" : "updated",
        title: `${REQUEST_LABEL[row.requestType] ?? "Data"} request`,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function deleteDataRequest(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(dataRequests)
      .where(eq(dataRequests.id, id))
      .returning({ id: dataRequests.id });
    return rows.length > 0;
  });
}

// --- Data breaches ----------------------------------------------------------
export function listDataBreaches(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx.select().from(dataBreaches).orderBy(desc(dataBreaches.discoveredAt)),
  );
}

export function createDataBreach(
  claims: UserClaims,
  workspaceId: string,
  input: CreateDataBreachInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(dataBreaches)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        title: input.title,
        ...(input.discoveredDate
          ? { discoveredAt: toTs(input.discoveredDate)! }
          : {}),
        occurredAt: toTs(input.occurredDate),
        description: input.description ?? null,
        dataInvolved: input.dataInvolved ?? null,
        affectedPeopleEstimate: input.affectedPeopleEstimate,
        riskLevel: input.riskLevel,
        containmentActions: input.containmentActions ?? null,
        icoNotificationAssessment: input.icoNotificationAssessment ?? null,
        individualNotificationAssessment:
          input.individualNotificationAssessment ?? null,
        status: input.status,
        owner: input.owner ?? null,
        professionalSupportRequired: input.professionalSupportRequired,
        closedAt: input.status === "closed" ? sql`now()` : null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "created",
      title: `Breach: ${rows[0].title}`,
      referenceId: rows[0].id,
      priority: input.riskLevel === "high" ? "high" : "none",
    });
    return rows[0];
  });
}

export function updateDataBreach(
  claims: UserClaims,
  id: string,
  input: UpdateDataBreachInput,
) {
  return withUser(claims, async (tx) => {
    const patch: Record<string, unknown> = { updatedBy: claims.sub };
    if (input.title !== undefined) patch.title = input.title;
    if (input.discoveredDate !== undefined)
      patch.discoveredAt = toTs(input.discoveredDate);
    if (input.occurredDate !== undefined)
      patch.occurredAt = toTs(input.occurredDate);
    if (input.description !== undefined) patch.description = input.description;
    if (input.dataInvolved !== undefined)
      patch.dataInvolved = input.dataInvolved;
    if (input.affectedPeopleEstimate !== undefined)
      patch.affectedPeopleEstimate = input.affectedPeopleEstimate;
    if (input.riskLevel !== undefined) patch.riskLevel = input.riskLevel;
    if (input.containmentActions !== undefined)
      patch.containmentActions = input.containmentActions;
    if (input.icoNotificationAssessment !== undefined)
      patch.icoNotificationAssessment = input.icoNotificationAssessment;
    if (input.individualNotificationAssessment !== undefined)
      patch.individualNotificationAssessment =
        input.individualNotificationAssessment;
    if (input.owner !== undefined) patch.owner = input.owner;
    if (input.professionalSupportRequired !== undefined)
      patch.professionalSupportRequired = input.professionalSupportRequired;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.closedAt = input.status === "closed" ? sql`now()` : null;
    }

    const rows = await tx
      .update(dataBreaches)
      .set(patch)
      .where(eq(dataBreaches.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "gdpr",
        action: input.status === "closed" ? "completed" : "updated",
        title: `Breach: ${row.title}`,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function deleteDataBreach(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(dataBreaches)
      .where(eq(dataBreaches.id, id))
      .returning({ id: dataBreaches.id });
    return rows.length > 0;
  });
}

// --- DPIAs ------------------------------------------------------------------
export function listDpias(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(dpias)
      .orderBy(sql`${dpias.reviewDate} asc nulls last`),
  );
}

export function createDpia(
  claims: UserClaims,
  workspaceId: string,
  input: CreateDpiaInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(dpias)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        title: input.title,
        project: input.project ?? null,
        processingSummary: input.processingSummary ?? null,
        necessity: input.necessity ?? null,
        risks: input.risks ?? null,
        controls: input.controls ?? null,
        residualRisk: input.residualRisk,
        status: input.status,
        owner: input.owner ?? null,
        reviewDate: input.reviewDate ?? null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "created",
      title: `DPIA: ${rows[0].title}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updateDpia(
  claims: UserClaims,
  id: string,
  input: UpdateDpiaInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(dpias)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(dpias.id, id))
      .returning();
    const row = rows[0];
    if (row)
      await recordActivity(tx, row.workspaceId, {
        module: "gdpr",
        action: input.status === "approved" ? "completed" : "updated",
        title: `DPIA: ${row.title}`,
        referenceId: row.id,
      });
    return row ?? null;
  });
}

export function deleteDpia(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(dpias)
      .where(eq(dpias.id, id))
      .returning({ id: dpias.id });
    return rows.length > 0;
  });
}

// --- Privacy notices --------------------------------------------------------
export function listPrivacyNotices(claims: UserClaims) {
  return withUser(claims, (tx) =>
    tx.select().from(privacyNotices).orderBy(desc(privacyNotices.updatedAt)),
  );
}

export function createPrivacyNotice(
  claims: UserClaims,
  workspaceId: string,
  input: CreatePrivacyNoticeInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(privacyNotices)
      .values({
        workspaceId,
        createdBy: claims.sub,
        updatedBy: claims.sub,
        version: input.version,
        status: input.status,
        organisation: input.organisation ?? null,
        contactDetails: input.contactDetails ?? null,
        dataCollected: input.dataCollected ?? null,
        purposes: input.purposes ?? null,
        lawfulBases: input.lawfulBases,
        sharing: input.sharing ?? null,
        internationalTransfers: input.internationalTransfers ?? null,
        retention: input.retention ?? null,
        rights: input.rights ?? null,
        complaints: input.complaints ?? null,
        reviewDate: input.reviewDate ?? null,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "created",
      title: `Privacy notice v${rows[0].version}`,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function updatePrivacyNotice(
  claims: UserClaims,
  id: string,
  input: UpdatePrivacyNoticeInput,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .update(privacyNotices)
      .set({ ...input, updatedBy: claims.sub })
      .where(eq(privacyNotices.id, id))
      .returning();
    return rows[0] ?? null;
  });
}

export function deletePrivacyNotice(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(privacyNotices)
      .where(eq(privacyNotices.id, id))
      .returning({ id: privacyNotices.id });
    return rows.length > 0;
  });
}

// --- GDPR readiness assessment (single current checklist per workspace) -----

export function getGdprAssessment(claims: UserClaims) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(gdprAssessments)
      .orderBy(desc(gdprAssessments.updatedAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

export function saveGdprAssessment(
  claims: UserClaims,
  workspaceId: string,
  answers: Record<string, GdprAnswer>,
) {
  return withUser(claims, async (tx) => {
    const { score, gaps, recommendations } = deriveGdprFindings(answers);
    const existing = (
      await tx
        .select({ id: gdprAssessments.id })
        .from(gdprAssessments)
        .orderBy(desc(gdprAssessments.updatedAt))
        .limit(1)
    )[0];

    let row;
    if (existing) {
      row = (
        await tx
          .update(gdprAssessments)
          .set({
            answers,
            score,
            gaps,
            recommendations,
            status: "completed",
            completedAt: sql`now()`,
            updatedBy: claims.sub,
          })
          .where(eq(gdprAssessments.id, existing.id))
          .returning()
      )[0];
    } else {
      row = (
        await tx
          .insert(gdprAssessments)
          .values({
            workspaceId,
            createdBy: claims.sub,
            updatedBy: claims.sub,
            assessmentType: "health_check",
            answers,
            score,
            gaps,
            recommendations,
            status: "completed",
            completedAt: sql`now()`,
          })
          .returning()
      )[0];
    }
    await recordActivity(tx, workspaceId, {
      module: "gdpr",
      action: "updated",
      title: `GDPR health check (${score}%)`,
      referenceId: row.id,
    });
    return row;
  });
}
