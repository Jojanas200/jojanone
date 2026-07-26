"use client";
import { useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// The business facts we pre-fill answers from (from the business profile).
export type ProfileFacts = {
  isLimited: boolean;
  vatRegistered: boolean;
  employerRegistered: boolean;
  employeeCount: number;
  processesPersonalData: boolean;
  tradesInternationally: boolean;
  supplierCount: number;
};

const QUESTIONS: [keyof Answers, string][] = [
  ["limited", "Is the business a UK limited company?"],
  ["vat", "Is the business VAT registered?"],
  ["employer", "Do you employ staff?"],
  ["employees_ge_5", "Do you employ 5 or more people?"],
  ["pensions", "Do you have workplace pension responsibilities?"],
  ["personal_data", "Do you process personal data?"],
  ["international", "Do you trade internationally?"],
  ["website", "Do you operate a public website or online service?"],
  ["regulated", "Do you carry out regulated activities?"],
  ["suppliers", "Do you rely on external suppliers or contractors?"],
];

type Answers = {
  limited: boolean;
  vat: boolean;
  employer: boolean;
  employees_ge_5: boolean;
  pensions: boolean;
  personal_data: boolean;
  international: boolean;
  website: boolean;
  regulated: boolean;
  suppliers: boolean;
};

function fromFacts(p: ProfileFacts): Answers {
  return {
    limited: p.isLimited,
    vat: p.vatRegistered,
    employer: p.employerRegistered || p.employeeCount > 0,
    employees_ge_5: p.employeeCount >= 5,
    pensions: p.employeeCount > 0,
    personal_data: p.processesPersonalData,
    international: p.tradesInternationally,
    website: true,
    regulated: false,
    suppliers: p.supplierCount > 0,
  };
}

// Deterministic mapping from answers to the obligation categories that likely
// apply. Guidance only - not a final legal determination.
function applicableCategories(a: Answers): { label: string; why: string }[] {
  const out: { label: string; why: string }[] = [];
  if (a.limited)
    out.push({
      label: "Companies House filings",
      why: "You operate a limited company.",
    });
  out.push({
    label: "Corporation Tax",
    why: "All trading companies file a CT600 annually.",
  });
  if (a.vat)
    out.push({ label: "VAT (MTD) returns", why: "You are VAT-registered." });
  if (a.employer)
    out.push({
      label: "PAYE, employers' liability insurance and right-to-work checks",
      why: "You employ people.",
    });
  if (a.pensions)
    out.push({
      label: "Workplace pension duties",
      why: "You have staff with pension duties.",
    });
  if (a.employees_ge_5)
    out.push({
      label: "Written health & safety policy",
      why: "The statutory threshold is 5 employees.",
    });
  if (a.personal_data)
    out.push({
      label: "UK GDPR obligations (ICO fee, ROPA, privacy notice)",
      why: "You process personal data.",
    });
  if (a.international)
    out.push({
      label: "International tax and data-transfer considerations",
      why: "You trade internationally.",
    });
  if (a.website)
    out.push({
      label: "Website transparency (privacy, cookies, terms)",
      why: "You run a public website or online service.",
    });
  if (a.regulated)
    out.push({
      label: "Sector regulator obligations",
      why: "You indicated regulated activity.",
    });
  if (a.suppliers)
    out.push({
      label: "Supplier due diligence and contracts",
      why: "You rely on external suppliers or contractors.",
    });
  return out;
}

export function ApplicabilityAssessment({ facts }: { facts: ProfileFacts }) {
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Answers>(() => fromFacts(facts));
  const [showResult, setShowResult] = useState(false);

  const categories = useMemo(() => applicableCategories(answers), [answers]);

  function reset(next: boolean) {
    setOpen(next);
    if (!next) {
      setShowResult(false);
      setAnswers(fromFacts(facts));
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ClipboardCheck className="mr-1.5 h-4 w-4" />
          Applicability assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Applicability assessment</DialogTitle>
          <DialogDescription>
            {showResult
              ? "Based on your answers, these obligation categories likely apply. This is guidance, not a final legal determination."
              : "A few questions about your business. Answers start from your profile - adjust anything that has changed."}
          </DialogDescription>
        </DialogHeader>

        {showResult ? (
          <ul className="space-y-2">
            {categories.map((c, i) => (
              <li
                key={i}
                className="rounded-lg border border-border p-3 text-sm"
              >
                <span className="font-medium text-foreground">{c.label}</span>{" "}
                <span className="text-muted-foreground">- {c.why}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            {QUESTIONS.map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 text-sm"
              >
                <span className="text-foreground">{label}</span>
                <Switch
                  checked={answers[key]}
                  onCheckedChange={(v) =>
                    setAnswers((p) => ({ ...p, [key]: v === true }))
                  }
                />
              </label>
            ))}
          </div>
        )}

        <DialogFooter>
          {showResult ? (
            <>
              <Button variant="outline" onClick={() => setShowResult(false)}>
                Back
              </Button>
              <Button onClick={() => reset(false)}>Close</Button>
            </>
          ) : (
            <Button onClick={() => setShowResult(true)}>
              See applicable categories
            </Button>
          )}
        </DialogFooter>
        <p className="text-[11px] text-muted-foreground">
          Jojan One organises obligations using a deterministic UK rule set. It
          does not perform live regulatory monitoring or provide legal advice.
        </p>
      </DialogContent>
    </Dialog>
  );
}
