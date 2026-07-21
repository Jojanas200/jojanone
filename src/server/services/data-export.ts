import { eq } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import {
  activities,
  businessProfiles,
  complianceObligations,
  contracts,
  conversations,
  dueDiligenceItems,
  employees,
  evidenceLibraryItems,
  governanceRecords,
  memberships,
  messages,
  notifications,
  organisations,
  processingActivities,
  reports,
  risks,
  tenderOpportunities,
  workspaces,
} from "../db/schema";

// Tenant-facing data-portability export (GDPR Article 20). Runs entirely under
// the caller's RLS context via withUser(), so it can only ever return the
// caller's OWN workspace records - the platform admin never touches this path.
// Unlike the operator "tenant summary" (metadata + counts), this is the real
// business data the workspace owns.

export interface WorkspaceExport {
  exportedAt: string;
  workspace: { id: string; name: string; org: string; createdAt: string };
  businessProfile: unknown;
  members: unknown[];
  records: Record<string, unknown[]>;
}

export async function getWorkspaceExport(
  claims: UserClaims,
  workspaceId: string,
): Promise<WorkspaceExport | null> {
  return withUser(claims, async (tx) => {
    const wsRow = (
      await tx
        .select({
          id: workspaces.id,
          name: workspaces.name,
          org: organisations.name,
          createdAt: workspaces.createdAt,
        })
        .from(workspaces)
        .innerJoin(
          organisations,
          eq(organisations.id, workspaces.organisationId),
        )
        .where(eq(workspaces.id, workspaceId))
        .limit(1)
    )[0];
    if (!wsRow) return null;

    const where = <T extends { workspaceId: unknown }>(t: T) =>
      eq(t.workspaceId as never, workspaceId);

    const [
      profile,
      members,
      contractRows,
      complianceRows,
      riskRows,
      employeeRows,
      gdprRows,
      governanceRows,
      dueDiligenceRows,
      tenderRows,
      evidenceRows,
      activityRows,
      reportRows,
      conversationRows,
      messageRows,
      notificationRows,
    ] = await Promise.all([
      tx
        .select()
        .from(businessProfiles)
        .where(where(businessProfiles))
        .limit(1),
      tx
        .select({
          userId: memberships.userId,
          role: memberships.role,
          createdAt: memberships.createdAt,
        })
        .from(memberships)
        .where(where(memberships)),
      tx.select().from(contracts).where(where(contracts)),
      tx
        .select()
        .from(complianceObligations)
        .where(where(complianceObligations)),
      tx.select().from(risks).where(where(risks)),
      tx.select().from(employees).where(where(employees)),
      tx.select().from(processingActivities).where(where(processingActivities)),
      tx.select().from(governanceRecords).where(where(governanceRecords)),
      tx.select().from(dueDiligenceItems).where(where(dueDiligenceItems)),
      tx.select().from(tenderOpportunities).where(where(tenderOpportunities)),
      tx.select().from(evidenceLibraryItems).where(where(evidenceLibraryItems)),
      tx.select().from(activities).where(where(activities)),
      tx.select().from(reports).where(where(reports)),
      tx.select().from(conversations).where(where(conversations)),
      tx.select().from(messages).where(where(messages)),
      tx.select().from(notifications).where(where(notifications)),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      workspace: {
        id: wsRow.id,
        name: wsRow.name,
        org: wsRow.org,
        createdAt: new Date(wsRow.createdAt).toISOString(),
      },
      businessProfile: profile[0] ?? null,
      members,
      records: {
        contracts: contractRows,
        complianceObligations: complianceRows,
        risks: riskRows,
        employees: employeeRows,
        processingActivities: gdprRows,
        governanceRecords: governanceRows,
        dueDiligenceItems: dueDiligenceRows,
        tenderOpportunities: tenderRows,
        evidence: evidenceRows,
        activities: activityRows,
        reports: reportRows,
        conversations: conversationRows,
        jovaMessages: messageRows,
        notifications: notificationRows,
      },
    };
  });
}
