import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/session";
import { requireModuleAccess } from "@/server/auth/guard";
import { getJovaBriefing } from "@/server/services/jova";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JovaBriefing } from "./JovaBriefing";
import { AskJova } from "./AskJova";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default async function JovaPage() {
  const claims = await getClaims();
  if (!claims) redirect("/login");
  await requireModuleAccess(claims, "jova");
  const b = await getJovaBriefing(claims);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Jova
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your always-on business protection intelligence.
        </p>
      </div>

      <Tabs defaultValue="ask">
        <TabsList>
          <TabsTrigger value="ask">Ask Jova</TabsTrigger>
          <TabsTrigger value="briefing">
            Daily briefing{b.total > 0 ? ` (${b.total})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ask" className="mt-4">
          <AskJova />
        </TabsContent>

        <TabsContent value="briefing" className="mt-4">
          <p className="mb-4 text-sm text-muted-foreground">
            {fmtDate(b.generatedFor)}
          </p>
          {b.total === 0 ? (
            <Card className="p-10 text-center">
              <p className="text-lg font-semibold text-foreground">
                Nothing needs your attention today.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Jova checked your compliance, risk, people, contracts, data
                protection, governance and learning - all clear.
              </p>
            </Card>
          ) : (
            <>
              <JovaBriefing findings={b.findings} counts={b.counts} />
              <p className="mt-6 text-[11px] text-muted-foreground">
                Findings are generated deterministically from your live data.
                Guidance, not legal advice.
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
