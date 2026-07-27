import type { UserClaims } from "../db";
import { listContracts } from "../services/contracts";
import { listRisks } from "../services/risk";
import { listEmployees } from "../services/hr";
import { listHrActions } from "../services/hr-actions";
import { listObligations } from "../services/compliance";
import { listProcessingActivities } from "../services/gdpr";
import {
  listDataBreaches,
  listDataRequests,
  listDpias,
} from "../services/gdpr-registers";
import { listGovernanceRecords } from "../services/governance";
import { listPolicies } from "../services/policies";
import { listEvidence } from "../services/evidence";
import { listTenderOpportunities } from "../services/tender";
import { listDueDiligenceItems } from "../services/investor";
import { listEntities } from "../services/business-entities";

// Record-level retrieval for Jova: the actual registers, not just scores.
// Every list call is an existing RLS-scoped service, so a workspace can only
// ever see its own records. Each register is flattened into compact one-line
// summaries carrying the fields owners ask about (dates, owners, notice
// periods, likelihood/impact, controls, review dates), ranked against the
// question so the most relevant records survive the per-module cap.

export interface RecordLine {
  module: string;
  refId: string | null;
  label: string;
  text: string;
}

export interface ModuleRecordsBlock {
  module: string;
  heading: string;
  total: number;
  lines: RecordLine[];
}

const PER_MODULE = 8;

const clip = (s: string | null | undefined, n = 180) => {
  const v = (s ?? "").replace(/\s+/g, " ").trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};
const part = (label: string, v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s ? `${label} ${s}` : "";
};
const join = (bits: (string | null | undefined)[]) =>
  bits.filter((b) => !!b && String(b).trim()).join("; ");

const money = (minor: number | null | undefined, currency?: string | null) =>
  minor === null || minor === undefined
    ? ""
    : `${currency ?? "GBP"} ${(minor / 100).toLocaleString("en-GB")}`;

const STOP = new Set(
  "the a an and or of to in on for with my our is are do does have has what which when who how any all this that show tell me about".split(
    " ",
  ),
);
const tokens = (q: string) =>
  q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

function rank(lines: RecordLine[], query: string | undefined, total: number) {
  if (!query?.trim() || lines.length <= PER_MODULE)
    return lines.slice(0, PER_MODULE);
  const qs = tokens(query);
  if (qs.length === 0) return lines.slice(0, PER_MODULE);
  const scored = lines.map((l, i) => {
    const hay = l.text.toLowerCase();
    const score = qs.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
    return { l, score, i };
  });
  // Matches first (by strength), then keep the register's own order.
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  void total;
  return scored.slice(0, PER_MODULE).map((x) => x.l);
}

export async function collectModuleRecords(
  claims: UserClaims,
  query?: string,
): Promise<ModuleRecordsBlock[]> {
  const [
    contracts,
    risks,
    employees,
    hrActions,
    obligations,
    ropa,
    dsars,
    breaches,
    dpias,
    governance,
    policies,
    evidence,
    tenders,
    dd,
    entities,
  ] = await Promise.all([
    listContracts(claims),
    listRisks(claims),
    listEmployees(claims),
    listHrActions(claims),
    listObligations(claims),
    listProcessingActivities(claims),
    listDataRequests(claims),
    listDataBreaches(claims),
    listDpias(claims),
    listGovernanceRecords(claims),
    listPolicies(claims),
    listEvidence(claims),
    listTenderOpportunities(claims),
    listDueDiligenceItems(claims),
    listEntities(claims),
  ]);

  const employeeName = new Map(employees.map((e) => [e.id, e.fullName]));

  const blocks: ModuleRecordsBlock[] = [
    {
      module: "contracts",
      heading: "Contracts register",
      total: contracts.length,
      lines: contracts.map((c) => ({
        module: "contracts",
        refId: c.id,
        label: c.title,
        text: join([
          `"${c.title}" with ${c.counterparty} (${c.contractType}, ${c.status})`,
          part("start", c.startDate),
          part("end", c.endDate),
          part("renewal", c.renewalDate),
          c.noticePeriodDays !== null
            ? `notice period ${c.noticePeriodDays} days`
            : "",
          part("value", money(c.valueMinor, c.currency)),
          part("owner", c.owner),
          part("risk", c.riskLevel),
          part("key terms:", clip(c.keyTerms)),
          part("obligations:", clip(c.obligations)),
          c.nextAction
            ? `next action: ${clip(c.nextAction, 100)}${c.nextActionDate ? ` by ${c.nextActionDate}` : ""}`
            : "",
        ]),
      })),
    },
    {
      module: "risk",
      heading: "Risk register",
      total: risks.length,
      lines: risks.map((r) => ({
        module: "risk",
        refId: r.id,
        label: r.riskTitle,
        text: join([
          `"${r.riskTitle}" (${r.riskCategory}, ${r.status})`,
          `likelihood ${r.likelihood} x impact ${r.impact} = inherent ${r.inherentScore} (${r.inherentRating})`,
          r.residualScore !== null
            ? `residual ${r.residualScore} (${r.residualRating})`
            : "",
          part("owner", r.riskOwner),
          part("response", r.response),
          part("review date", r.reviewDate),
          part("controls:", clip(r.controls)),
          Array.isArray(r.mitigations) && r.mitigations.length
            ? `${r.mitigations.length} mitigation action(s)`
            : "",
        ]),
      })),
    },
    {
      module: "hr",
      heading: "People (HR register)",
      total: employees.length,
      lines: employees.map((e) => ({
        module: "hr",
        refId: e.id,
        label: e.fullName,
        text: join([
          `${e.fullName}, ${e.jobTitle ?? "role not set"} (${e.employmentType}, ${e.employmentStatus})`,
          part("department", e.department),
          part("started", e.startDate),
          part("probation ends", e.probationEndDate),
          `right-to-work ${e.rightToWorkStatus}${e.rightToWorkExpiry ? ` (expires ${e.rightToWorkExpiry})` : ""}`,
          part("contract", e.contractStatus),
          part("policy acknowledgements", e.policyAcknowledgementStatus),
          part("training", e.trainingStatus),
          part("next review", e.nextReviewDate),
        ]),
      })),
    },
    {
      module: "hr",
      heading: "HR actions",
      total: hrActions.length,
      lines: hrActions.map((a) => ({
        module: "hr",
        refId: a.id,
        label: a.title,
        text: join([
          `"${a.title}" (${a.actionType}, ${a.priority} priority, ${a.status})`,
          a.employeeId
            ? part("for", employeeName.get(a.employeeId) ?? null)
            : "",
          part("due", a.dueDate),
        ]),
      })),
    },
    {
      module: "compliance",
      heading: "Compliance obligations",
      total: obligations.length,
      lines: obligations.map((o) => ({
        module: "compliance",
        refId: o.id,
        label: o.title,
        text: join([
          `"${o.title}" (${o.category}${o.regulator ? `, ${o.regulator}` : ""})`,
          `status ${o.status}`,
          part("priority", o.priority),
          part("due", o.dueDate),
          part("recurrence", o.recurrence),
          part("owner", o.owner),
          part("evidence", o.evidenceStatus),
          part("required action:", clip(o.requiredAction, 120)),
        ]),
      })),
    },
    {
      module: "gdpr",
      heading: "GDPR processing activities (ROPA)",
      total: ropa.length,
      lines: ropa.map((p) => ({
        module: "gdpr",
        refId: p.id,
        label: p.activityName,
        text: join([
          `"${p.activityName}" (${p.status})`,
          part("purpose:", clip(p.businessPurpose, 100)),
          part("lawful basis", p.lawfulBasis),
          part("data subjects", clip(p.dataSubjects, 80)),
          part("retention", clip(p.retentionPeriod, 80)),
          part("owner", p.owner),
          part("review", p.reviewDate),
        ]),
      })),
    },
    {
      module: "gdpr",
      heading: "GDPR data subject requests",
      total: dsars.length,
      lines: dsars.map((r) => ({
        module: "gdpr",
        refId: r.id,
        label: `${r.requestType} request`,
        text: join([
          `${r.requestType} request${r.requesterReference ? ` (${r.requesterReference})` : ""}`,
          `status ${r.status}`,
          part("received", r.receivedDate),
          part("due", r.dueDate),
          part("owner", r.assignedOwner),
        ]),
      })),
    },
    {
      module: "gdpr",
      heading: "GDPR data breaches",
      total: breaches.length,
      lines: breaches.map((b) => ({
        module: "gdpr",
        refId: b.id,
        label: b.title,
        text: join([
          `"${b.title}" (${b.status}, risk ${b.riskLevel})`,
          part("discovered", b.discoveredAt?.toISOString().slice(0, 10)),
          part("owner", b.owner),
          part("data involved:", clip(b.dataInvolved, 100)),
        ]),
      })),
    },
    {
      module: "gdpr",
      heading: "GDPR DPIAs",
      total: dpias.length,
      lines: dpias.map((d) => ({
        module: "gdpr",
        refId: d.id,
        label: d.title,
        text: join([
          `"${d.title}" (${d.status})`,
          part("project", d.project),
          part("residual risk", d.residualRisk),
          part("owner", d.owner),
          part("review", d.reviewDate),
        ]),
      })),
    },
    {
      module: "governance",
      heading: "Governance records",
      total: governance.length,
      lines: governance.map((g) => ({
        module: "governance",
        refId: g.id,
        label: g.title,
        text: join([
          `"${g.title}" (${g.recordType}, ${g.status})`,
          part("meeting", g.meetingDate),
          part("decision date", g.decisionDate),
          part("decision:", clip(g.decision, 120)),
          part("decision maker", g.decisionMaker),
          part("owner", g.owner),
          part("review", g.reviewDate),
        ]),
      })),
    },
    {
      module: "policies",
      heading: "Policies register",
      total: policies.length,
      lines: policies.map((p) => ({
        module: "policies",
        refId: p.id,
        label: p.policyName,
        text: join([
          `"${p.policyName}" (${p.policyCategory ?? "uncategorised"}, v${p.version}, ${p.status})`,
          part("owner", p.owner),
          part("review", p.reviewDate),
          p.acknowledgementRequired
            ? `staff sign-off ${p.acknowledgementStatus}`
            : "",
          part("professional review", p.professionalReviewStatus),
        ]),
      })),
    },
    {
      module: "evidence",
      heading: "Evidence library",
      total: evidence.length,
      lines: evidence.map((e) => ({
        module: "evidence",
        refId: e.id,
        label: e.title,
        text: join([
          `"${e.title}" (${e.category}, ${e.status})`,
          part("source", e.sourceModule),
          part("owner", e.owner),
          part("review", e.reviewDate),
        ]),
      })),
    },
    {
      module: "tender-ready",
      heading: "Tender opportunities",
      total: tenders.length,
      lines: tenders.map((t) => ({
        module: "tender-ready",
        refId: t.id,
        label: t.title,
        text: join([
          `"${t.title}" (${t.authority ?? "authority not set"}, ${t.status})`,
          part("submission deadline", t.submissionDeadline),
          part("value", t.contractValue),
          part("owner", t.owner),
        ]),
      })),
    },
    {
      module: "investor-ready",
      heading: "Investor due diligence items",
      total: dd.length,
      lines: dd.map((d) => ({
        module: "investor-ready",
        refId: d.id,
        label: d.title,
        text: join([
          `"${d.title}" (${d.category}, ${d.status})`,
          part("priority", d.priority),
          part("owner", d.owner),
          part("review", d.reviewDate),
        ]),
      })),
    },
    {
      module: "business-map",
      heading: "Business relationships (customers, suppliers, partners)",
      total: entities.length,
      lines: entities.map((e) => ({
        module: "business-map",
        refId: e.id,
        label: e.name,
        text: join([
          `${e.name} (${e.entityType}, ${e.status})`,
          part("relationship:", clip(e.relationship, 80)),
          part("importance", e.importance),
          part("risk", e.riskLevel),
          part("contact", e.contactName),
          part("review", e.reviewDate),
        ]),
      })),
    },
  ];

  return blocks
    .filter((b) => b.total > 0)
    .map((b) => ({ ...b, lines: rank(b.lines, query, b.total) }));
}
