"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaField, SelectField, TextField } from "../_shared/board-bits";
import { nice } from "../_shared/format";
import { printDocument, type PrintBlock } from "../_shared/print";
import type { getInvestorProfile } from "@/server/services/investor-readiness";

type Profile = Awaited<ReturnType<typeof getInvestorProfile>>;

const STAGES = ["pre_seed", "seed", "series_a", "series_b", "growth", "other"];
const TYPES = ["equity", "debt", "grant", "convertible", "undecided"];
const STATUSES = ["preparing", "live", "closed"];

export function InvestorProfileForm({
  profile,
  canWrite,
}: {
  profile: Profile;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    fundingStage: profile?.fundingStage ?? "pre_seed",
    amountSought: profile?.amountSought ? String(profile.amountSought) : "",
    currency: profile?.currency ?? "GBP",
    fundingPurpose: profile?.fundingPurpose ?? "",
    targetCloseDate: profile?.targetCloseDate ?? "",
    currentRevenueBand: profile?.currentRevenueBand ?? "",
    growthSummary: profile?.growthSummary ?? "",
    tractionSummary: profile?.tractionSummary ?? "",
    marketSummary: profile?.marketSummary ?? "",
    teamSummary: profile?.teamSummary ?? "",
    investmentType: profile?.investmentType ?? "undecided",
    status: profile?.status ?? "preparing",
  });
  const set = (k: keyof typeof f) => (v: string) =>
    setF((p) => ({ ...p, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/investor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fundingStage: f.fundingStage,
          amountSought: f.amountSought ? parseInt(f.amountSought, 10) : 0,
          currency: f.currency || "GBP",
          fundingPurpose: f.fundingPurpose || null,
          targetCloseDate: f.targetCloseDate || null,
          currentRevenueBand: f.currentRevenueBand || null,
          growthSummary: f.growthSummary || null,
          tractionSummary: f.tractionSummary || null,
          marketSummary: f.marketSummary || null,
          teamSummary: f.teamSummary || null,
          investmentType: f.investmentType,
          status: f.status,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Profile saved");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Funding stage"
            value={f.fundingStage}
            onChange={set("fundingStage")}
            options={STAGES}
          />
          <SelectField
            label="Investment type"
            value={f.investmentType}
            onChange={set("investmentType")}
            options={TYPES}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TextField
            label="Amount sought"
            type="number"
            value={f.amountSought}
            onChange={set("amountSought")}
          />
          <TextField
            label="Currency"
            value={f.currency}
            onChange={set("currency")}
          />
          <TextField
            label="Target close"
            type="date"
            value={f.targetCloseDate}
            onChange={set("targetCloseDate")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Current revenue band"
            value={f.currentRevenueBand}
            onChange={set("currentRevenueBand")}
          />
          <SelectField
            label="Status"
            value={f.status}
            onChange={set("status")}
            options={STATUSES}
          />
        </div>
        <AreaField
          label="Funding purpose"
          value={f.fundingPurpose}
          onChange={set("fundingPurpose")}
        />
        <AreaField
          label="Growth summary"
          value={f.growthSummary}
          onChange={set("growthSummary")}
        />
        <AreaField
          label="Traction summary"
          value={f.tractionSummary}
          onChange={set("tractionSummary")}
        />
        <AreaField
          label="Market summary"
          value={f.marketSummary}
          onChange={set("marketSummary")}
        />
        <AreaField
          label="Team summary"
          value={f.teamSummary}
          onChange={set("teamSummary")}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const blocks: PrintBlock[] = [
                {
                  kind: "rows",
                  rows: [
                    ["Funding stage", nice(f.fundingStage)],
                    ["Investment type", nice(f.investmentType)],
                    ["Status", f.status],
                    [
                      "Amount sought",
                      f.amountSought
                        ? `${f.currency} ${Number(f.amountSought).toLocaleString("en-GB")}`
                        : "-",
                    ],
                    ["Target close", f.targetCloseDate || "-"],
                    ["Revenue band", f.currentRevenueBand || "-"],
                  ],
                },
              ];
              if (f.fundingPurpose)
                blocks.push({
                  kind: "text",
                  heading: "Funding purpose",
                  body: f.fundingPurpose,
                });
              if (f.growthSummary)
                blocks.push({
                  kind: "text",
                  heading: "Growth",
                  body: f.growthSummary,
                });
              if (f.tractionSummary)
                blocks.push({
                  kind: "text",
                  heading: "Traction",
                  body: f.tractionSummary,
                });
              if (f.marketSummary)
                blocks.push({
                  kind: "text",
                  heading: "Market",
                  body: f.marketSummary,
                });
              if (f.teamSummary)
                blocks.push({
                  kind: "text",
                  heading: "Team",
                  body: f.teamSummary,
                });
              printDocument({
                title: "Funding profile",
                meta: `Investor readiness · ${nice(f.fundingStage)} · ${f.status}`,
                blocks,
                disclaimer: "Prepared from your own records, not advice.",
              });
            }}
          >
            Print summary
          </Button>
          {canWrite && (
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
