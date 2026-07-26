import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { listTenderOpportunities } from "@/server/services/tender";
import {
  getBidAssessment,
  getTenderReadiness,
  listTenderRequirements,
  listTenderResponses,
} from "@/server/services/tender-readiness";
import { NewOpportunity } from "./NewOpportunity";
import { OpportunitiesBoard } from "./OpportunitiesBoard";
import { TenderReadinessHeader } from "./TenderReadinessHeader";
import { TenderRequirementsBoard } from "./TenderRequirementsBoard";
import { TenderResponsesBoard } from "./TenderResponsesBoard";
import { BidDecisionPanel } from "./BidDecisionPanel";
import { WriteGate } from "../WriteGate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default async function TenderReadyPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  const { access } = await requireModuleAccess(claims, "tender-ready");
  const [rows, requirements, responses, bid, readiness] = await Promise.all([
    listTenderOpportunities(claims),
    listTenderRequirements(claims),
    listTenderResponses(claims),
    getBidAssessment(claims),
    getTenderReadiness(claims),
  ]);
  const canWrite = access.canWrite;
  const oppOptions = rows.map((o) => ({ id: o.id, title: o.title }));

  const bidForClient = bid
    ? {
        answers: bid.answers,
        overallScore: bid.overallScore,
        recommendation: bid.recommendation,
        decision: bid.decision,
        decisionReason: bid.decisionReason,
      }
    : null;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Tender Ready
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Win more of the contracts you bid for.
        </p>
      </div>

      <TenderReadinessHeader readiness={readiness} canWrite={canWrite} />

      <Tabs defaultValue="opportunities">
        <TabsList>
          <TabsTrigger value="opportunities">
            Opportunities{rows.length ? ` (${rows.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="requirements">
            Requirements{requirements.length ? ` (${requirements.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="responses">
            Responses{responses.length ? ` (${responses.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="bid">Bid decision</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Track tenders, deadlines and bid decisions in one place.
            </p>
            <WriteGate>
              <NewOpportunity />
            </WriteGate>
          </div>
          <OpportunitiesBoard
            opportunities={rows}
            canWrite={canWrite}
            requirements={requirements.map((r) => ({
              opportunityId: r.opportunityId,
              title: r.title,
              requirementType: r.requirementType,
              mandatory: r.mandatory,
              status: r.status,
            }))}
          />
        </TabsContent>

        <TabsContent value="requirements" className="mt-6">
          <TenderRequirementsBoard
            requirements={requirements}
            canWrite={canWrite}
            opportunities={oppOptions}
          />
        </TabsContent>

        <TabsContent value="responses" className="mt-6">
          <TenderResponsesBoard
            responses={responses}
            canWrite={canWrite}
            opportunities={oppOptions}
          />
        </TabsContent>

        <TabsContent value="bid" className="mt-6">
          <BidDecisionPanel assessment={bidForClient} canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
