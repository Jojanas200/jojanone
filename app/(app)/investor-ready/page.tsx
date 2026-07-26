import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listDueDiligenceItems } from "@/server/services/investor";
import {
  getInvestorProfile,
  getReadinessAssessment,
  listDataRoomItems,
} from "@/server/services/investor-readiness";
import { InvestorReadinessPanel } from "./InvestorReadinessPanel";
import { InvestorActionPlan } from "./InvestorActionPlan";
import { InvestorProfileForm } from "./InvestorProfileForm";
import { DataRoomBoard } from "./DataRoomBoard";
import { DueDiligenceBoard } from "./DueDiligenceBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function InvestorReadyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "investor-ready");
  const [rows, profile, dataRoom, readiness] = await Promise.all([
    listDueDiligenceItems(claims),
    getInvestorProfile(claims),
    listDataRoomItems(claims),
    getReadinessAssessment(claims),
  ]);
  const canWrite = access.canWrite;

  const readinessForClient = readiness
    ? {
        answers: readiness.answers,
        overallScore: readiness.overallScore,
        corporateScore: readiness.corporateScore,
        financialScore: readiness.financialScore,
        legalScore: readiness.legalScore,
        complianceScore: readiness.complianceScore,
        commercialScore: readiness.commercialScore,
        peopleScore: readiness.peopleScore,
        dataRoomScore: readiness.dataRoomScore,
        redFlags: readiness.redFlags,
      }
    : null;
  const recommendedActions =
    (readiness?.recommendedActions as string[] | undefined) ?? [];
  const ddForPlan = rows.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category,
    priority: r.priority,
    status: r.status,
    owner: r.owner,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Investor Ready
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Be ready before they ask.
        </p>
      </div>

      <Tabs defaultValue="readiness">
        <TabsList>
          <TabsTrigger value="readiness">Readiness</TabsTrigger>
          <TabsTrigger value="plan">Action plan</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="dataroom">
            Data room{dataRoom.length ? ` (${dataRoom.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="diligence">
            Due diligence{rows.length ? ` (${rows.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="readiness" className="mt-6">
          <InvestorReadinessPanel
            assessment={readinessForClient}
            canWrite={canWrite}
          />
        </TabsContent>

        <TabsContent value="plan" className="mt-6">
          <InvestorActionPlan
            recommendedActions={recommendedActions}
            dueDiligence={ddForPlan}
          />
        </TabsContent>

        <TabsContent value="profile" className="mt-6">
          <InvestorProfileForm profile={profile} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="dataroom" className="mt-6">
          <DataRoomBoard items={dataRoom} canWrite={canWrite} />
        </TabsContent>

        <TabsContent value="diligence" className="mt-6">
          <DueDiligenceBoard items={rows} canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
