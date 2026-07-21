import type { CoreDataState, JovaMessage, ModuleKey } from "./types";
import { computeSnapshot, isOpen, isOverdue, topPriorities } from "./selectors";
import {
  contractIsExpiring,
  contractIssues,
  employeeMetrics,
  entityMetrics,
  openHrActions,
} from "./business-selectors";
import {
  obligationMetrics,
  gdprMetrics,
  governanceMetrics,
  riskMetrics,
} from "./cg-selectors";
import {
  investorReadinessMetrics,
  tenderReadinessMetrics,
  categoryLabel,
  ddStatusLabel,
  reqStatusLabel,
} from "./growth-selectors";
import {
  academyMetrics,
  buildRecommendations,
  findLearner,
  listLearners,
  progressFor,
  bestAttempt,
  certificateFor,
  isAssignmentOverdue,
  isDueSoon,
} from "./academy-selectors";
import {
  COURSES,
  getCourse,
  type Course,
  type CourseLesson,
} from "./academy-catalog";

type Draft = Omit<JovaMessage, "id" | "created_at" | "conversation_id">;

export interface JovaRef {
  reference_type: string | null;
  reference_id: string | null;
}

const DISCLAIMER =
  "Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.";

// --- Per-course plain-English explanations ------------------------------
// Used when a learner asks Jova to "explain / teach me / help me understand
// / tell me about" a specific Academy course. Content is course-shaped
// business guidance, not legal advice - every reply keeps the disclaimer.
interface CourseExplain {
  about: string;
  why: string;
  understand: string;
  example: string;
  actions: string[];
  support: string;
}
const COURSE_EXPLAIN: Record<string, CourseExplain> = {
  crs_gdpr_essentials: {
    about:
      "UK GDPR sets out how you handle personal data - the names, emails, HR records, customer details and other information about identifiable people that flows through your business every day.",
    why: "Even small businesses process personal data, and mistakes can lead to complaints, reputational damage or regulatory attention. Getting the basics right protects your customers, your staff and your business.",
    understand:
      "You will understand the six data-protection principles, when you need a lawful basis to process data, the main individual rights, and what a proportionate approach to security and breach handling looks like.",
    example:
      "Fictional example - Fairhurst Interiors Ltd, a 6-person design studio, keeps client mood-boards, supplier contacts and staff HR records. The course helps the owner see which of those are personal data, which lawful bases apply, and what its privacy notice and breach log should cover.",
    actions: [
      "Confirm your privacy notice is current and easy to find.",
      "Keep a short record of what personal data you hold and why (a simple ROPA).",
      "Log any data subject request or personal-data incident as soon as it arises.",
    ],
    support:
      "Take specialist advice for international transfers, special-category data (health, biometrics, criminal offence data), large-scale processing, or serious breaches.",
  },
  crs_privacy_notice: {
    about:
      "A privacy notice tells customers, staff and website visitors what personal data you collect, why, how long you keep it and what rights they have.",
    why: "It is the single most visible sign that your business takes data protection seriously and is one of the first documents a regulator, investor or enterprise customer will check.",
    understand:
      "You will understand what a privacy notice must contain, how to write it in plain English, how to keep it up to date, and how to signpost data subject rights clearly.",
    example:
      "Fictional example - Brookline Roofing, a 4-person trades business, uses a website form to book quotes. The course helps the owner explain in plain language what happens to the form data, how long quotes are kept, and who to contact with a data question.",
    actions: [
      "Review your privacy notice at least once a year and after any change to how you use data.",
      "List each purpose of processing and the lawful basis alongside it.",
      "Publish a clear contact route for privacy questions and data subject requests.",
    ],
    support:
      "Take advice where you process children's data, share data with partners abroad, or use tracking and profiling that goes beyond basic analytics.",
  },
  crs_cyber_essentials: {
    about:
      "Cyber security basics for a small business - the everyday practices that keep accounts, devices, email and data reasonably safe from common attacks.",
    why: "Most incidents affecting small businesses come from phishing, weak passwords, unpatched devices or misconfigured cloud services. A few consistent habits significantly reduce that risk.",
    understand:
      "You will understand how to spot phishing, why multi-factor authentication matters, how to keep devices and software up to date, and how to respond calmly when something looks wrong.",
    example:
      "Fictional example - Northgate Coaching Ltd receives an urgent email that appears to come from its bank. The course helps the team pause, verify through a trusted channel, enable MFA on the finance mailbox, and record what happened.",
    actions: [
      "Turn on multi-factor authentication for email, finance and admin accounts where feasible.",
      "Keep operating systems, browsers and key apps set to automatic updates.",
      "Agree a simple rule for reporting suspicious messages internally.",
    ],
    support:
      "Take specialist advice for suspected ransomware, business email compromise, incidents involving customer data, or anything you cannot safely contain in-house.",
  },
  crs_rtw: {
    about:
      "Right-to-work checks confirm that a person you employ is legally allowed to do the work you are offering, before their first day.",
    why: "Getting these checks right protects the business from civil penalties, supports fair recruitment, and gives an audit trail if the position is ever questioned.",
    understand:
      "You will understand which documents or online checks are acceptable, when to use the Home Office share-code service, how to record checks, and when a follow-up check is needed.",
    example:
      "Fictional example - Meadowbank Care hires a new support worker. The course helps the manager confirm the correct check type, record the date and evidence, and set a diary reminder for any time-limited status.",
    actions: [
      "Complete a right-to-work check before the first day of work.",
      "Record the check type, date, and evidence reference in one place.",
      "Diary any follow-up check needed before time-limited permission expires.",
    ],
    support:
      "Take immigration advice for complex sponsorship, unusual visa categories, or where a check cannot be completed with confidence.",
  },
  crs_director_duties: {
    about:
      "Director duties and good governance - what company directors are expected to do under the Companies Act and how simple governance habits support better decisions.",
    why: "Even in a small company, directors carry personal duties. Clear meetings, records and approvals help demonstrate that decisions were made properly and in the company's interests.",
    understand:
      "You will understand the general director duties, what a proportionate meeting and minute pattern looks like, and how to record key approvals and conflicts of interest.",
    example:
      "Fictional example - Hallow Cabinetry Ltd holds a monthly directors' catch-up. The course helps the two directors capture short minutes, log a supplier conflict of interest and approve a new lease in writing.",
    actions: [
      "Hold regular directors' meetings, however brief, and keep short minutes.",
      "Record material approvals - contracts, borrowing, distributions - in writing.",
      "Declare and log any personal interest in a company decision.",
    ],
    support:
      "Take advice before director loans, share issues, distributions when reserves are tight, or any situation where duties may conflict.",
  },
  crs_risk_mgmt: {
    about:
      "A practical, plain-English approach to identifying, rating and controlling the risks that could stop your business from delivering.",
    why: "A short, honest risk register is one of the cheapest tools a small business has - it turns scattered worries into a manageable list of actions and owners.",
    understand:
      "You will understand how to describe a risk clearly, rate likelihood and impact, choose proportionate controls, and review the register on a regular rhythm.",
    example:
      "Fictional example - Northgate Coaching Ltd depends on one key trainer. The course helps the founder log the concentration risk, add a simple mitigation (a backup associate trainer) and set a quarterly review.",
    actions: [
      "Keep a short, live risk register with owners and review dates.",
      "Distinguish inherent from residual rating so mitigation progress is visible.",
      "Escalate any high or critical residual risk for a formal decision.",
    ],
    support:
      "Take specialist input for safety-critical operations, regulated activities, or high-value contracts where risk transfer needs professional review.",
  },
  crs_contract_mgmt: {
    about:
      "Managing customer and supplier contracts - from signature through renewals, changes and endings - without losing track of key dates or obligations.",
    why: "Missed renewal windows, quiet auto-renewals and unclear termination rights are among the most common avoidable costs in a small business.",
    understand:
      "You will understand how to log contracts consistently, monitor renewal and notice periods, manage variations, and close out contracts cleanly.",
    example:
      "Fictional example - Brookford Care runs 14 supplier contracts. The course helps the operations lead build a single register with renewal dates, notice periods and named owners, and set alerts 90 days ahead.",
    actions: [
      "Keep every active contract in one register with owner, value and end date.",
      "Set a reminder at least one notice period before every renewal or break.",
      "Record any variation in writing and store it with the original contract.",
    ],
    support:
      "Take legal advice on unusual liability caps, IP assignments, disputes, or contracts with public sector or overseas counterparties.",
  },
  crs_ir35: {
    about:
      "Awareness of contractor status and the off-payroll working rules (IR35) - what shapes an employment status decision and where the practical risks sit.",
    why: "Getting status wrong can create unexpected tax, penalty and employment-rights exposure for the business engaging the contractor.",
    understand:
      "You will understand the main status factors (control, substitution, mutuality of obligation), what a status determination looks like, and how to keep evidence of how the engagement actually works.",
    example:
      "Fictional example - Fairhurst Interiors Ltd engages a self-employed CAD specialist. The course helps the owner think through control, substitution and integration, and keep a short written note explaining the status view.",
    actions: [
      "Complete a status assessment before engaging a contractor.",
      "Keep a short written summary of the reasoning and evidence.",
      "Re-assess if the working pattern changes materially.",
    ],
    support:
      "Take tax or employment advice for higher-value engagements, disputed determinations, or when engaging via personal service companies at scale.",
  },
  crs_hs: {
    about:
      "Health and safety management for small businesses - identifying how people could be harmed through your work and taking proportionate steps to control those risks.",
    why: "Employers have responsibilities to manage workplace health and safety risks. The arrangements a small office needs will usually differ from those required by a care provider, construction business or manufacturer, so the approach must fit the actual work.",
    understand:
      "You will understand what a suitable and sufficient risk assessment looks like in practice, how to set out simple health and safety arrangements, how to communicate with employees, and how to record and assess incidents. Where your business has five or more employees, the health and safety policy must generally be recorded in writing.",
    example:
      "Fictional example - a consultancy introducing regular home working considers workstation setup, equipment, communication and wellbeing. A separate care provider also assesses moving and handling, lone working, infection control and risks in clients' homes. Both businesses record their arrangements and review them when the work changes.",
    actions: [
      "Carry out a suitable and sufficient risk assessment for the actual work, and review it when the work or workforce changes.",
      "If you employ five or more people, record your health and safety policy in writing.",
      "Record and assess incidents appropriately - only certain qualifying work-related incidents are reportable under RIDDOR, so treat reporting as a considered decision rather than an automatic step.",
    ],
    support:
      "Obtain competent health and safety support for serious, complex or uncertain risks, and whenever it is unclear whether an incident is reportable under RIDDOR.",
  },
  crs_tender_evidence: {
    about:
      "Getting a business ready to bid - the evidence, policies and references buyers typically ask for in tenders and supplier questionnaires.",
    why: "Most small-business bids are won or lost on how easy it is to evidence the basics. A tidy evidence pack turns weeks of scramble into a short update job.",
    understand:
      "You will understand which policies and certificates buyers commonly require, how to map tender questions to evidence, and how to keep a bid-ready folder up to date.",
    example:
      "Fictional example - Hallow Cabinetry Ltd bids for a local authority framework. The course helps the team assemble insurance certificates, cyber and H&S policies, quality references and a short capability statement in one place.",
    actions: [
      "Keep an evidence library with current policies, certificates and references.",
      "Map recurring tender questions to the evidence that answers them.",
      "Refresh evidence at least annually and immediately after any material change.",
    ],
    support:
      "Take bid or procurement advice for complex frameworks, joint bids, or contracts with unusual liability or performance regimes.",
  },
  crs_investor_dd: {
    about:
      "Investor due-diligence fundamentals - the corporate, financial, legal and compliance information investors typically review before backing a small business.",
    why: "A well-organised data room shortens diligence, keeps momentum with investors and often improves valuation and terms.",
    understand:
      "You will understand the main due-diligence categories, what good evidence looks like in each, and how to close common gaps before they surface in a live process.",
    example:
      "Fictional example - Northgate Coaching Ltd prepares for a seed round. The course helps the founder assemble cap table, key contracts, IP assignments, employment records and compliance evidence in a simple folder structure.",
    actions: [
      "Keep a live data-room outline mapped to standard diligence categories.",
      "Close missing or unreviewed items before opening a formal process.",
      "Record who owns each item and when it was last refreshed.",
    ],
    support:
      "Take corporate legal, tax and accounting advice ahead of any live fundraising or sale process.",
  },
  crs_breach_response: {
    about:
      "How to respond calmly and proportionately when a personal data breach is suspected or confirmed.",
    why: "The first hour of a breach usually decides whether it becomes a minor incident or a serious one. A simple, rehearsed response plan removes guesswork under pressure.",
    understand:
      "You will understand how to triage a suspected breach, contain it, assess risk to individuals, decide whether notification is likely to be required, and record the incident.",
    example:
      "Fictional example - Meadowbank Legal Services misfires a client update email to the wrong distribution list. The course helps the team recall the message where possible, assess the risk to individuals, log the incident and decide on notification.",
    actions: [
      "Contain the incident first - stop the exposure and preserve evidence.",
      "Assess the risk to individuals before deciding on notification.",
      "Record every breach or near-miss in the breach log, even if not reported.",
    ],
    support:
      "Take specialist advice immediately for ransomware, large-scale incidents, incidents involving special-category data, or where regulatory notification is likely.",
  },
};

const EXPLAIN_INTENT_RE =
  /\b(explain|teach me|help me understand|tell me about|walk me through|what is|what's|overview of|introduce)\b/i;

function academyCourseExplainReply(
  state: CoreDataState,
  course: Course,
): Draft {
  const e = COURSE_EXPLAIN[course.id];
  const owner = findLearner(state, "owner");
  const prog = owner ? progressFor(state, "owner", course.id) : null;
  const cert = owner ? certificateFor(state, "owner", course.id) : null;
  const status = cert
    ? `Status: certificate on file (${cert.reference}, ${fmt(cert.completed_at)}).`
    : prog
      ? `Status: in progress - ${prog.lessons_completed.length}/${course.lessons.length} lesson(s) complete.`
      : "Status: not started.";
  const summary = `Summary - ${course.category} · ${course.difficulty} · ~${course.duration_minutes} min · ${course.lessons.length} lessons · ${course.quiz.length} quiz questions. ${status}`;
  const fallback: CourseExplain = {
    about: course.short_description,
    why: `This course supports small businesses working on ${course.category.toLowerCase()}.`,
    understand: `You will understand: ${course.objectives.join("; ")}.`,
    example:
      "Fictional example - a small UK business working through this topic uses the course to structure its approach and evidence.",
    actions: course.objectives.slice(0, 3).map((o) => `${o}.`),
    support:
      "Take qualified professional advice where the situation is complex, high-value, or where legal or regulatory judgement is required.",
  };
  const x = e ?? fallback;
  const body = [
    `${course.title} - plain-English explanation.`,
    `1. What this course is about\n${x.about}`,
    `2. Why it matters to a small business\n${x.why}`,
    `3. What you will understand\n${x.understand}`,
    `4. A short fictional business example\n${x.example}`,
    `5. Practical actions you can take\n${x.actions.map((a) => `• ${a}`).join("\n")}`,
    `6. When professional support may be needed\n${x.support}`,
    `7. Course lessons - pick one below to go deeper.`,
    summary,
  ].join("\n\n");
  return {
    sender: "jova",
    content: body,
    reference_type: "course",
    reference_id: course.id,
    suggested_action: {
      label: "Open course",
      kind: "navigate",
      target: `/academy?c=${course.id}`,
    },
    structured: {
      items: course.lessons.map((l, i) => ({
        title: `Lesson ${i + 1}: ${l.title}`,
        subtitle: l.objective,
        module: "academy" as ModuleKey,
        id: `${course.id}::${l.id}::${i}`,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function ratingLabel(score: number): string {
  if (score >= 20) return "Critical";
  if (score >= 12) return "High";
  if (score >= 6) return "Medium";
  return "Low";
}

function splitList(s: string | undefined | null): string[] {
  if (!s) return [];
  return s
    .split(/[;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function fmt(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d.slice(0, 10);
  }
}

// --- Per-reference deterministic responses ------------------------------
function replyForReference(
  state: CoreDataState,
  ref: JovaRef,
  _prompt: string,
): Draft | null {
  if (!ref.reference_id) return null;
  switch (ref.reference_type) {
    case "risk": {
      const r = state.risks.find((x) => x.id === ref.reference_id);
      if (!r) return null;
      const linkedObl = r.linked_obligation_id
        ? state.compliance_obligations.find(
            (o) => o.id === r.linked_obligation_id,
          )
        : null;
      const controls = splitList(r.controls);
      const mitigations = r.mitigation_actions ?? [];
      const items = [
        ...controls.map((c, i) => ({
          title: `Control: ${c}`,
          id: `ctrl-${i}`,
        })),
        ...mitigations.map((m) => ({
          title: m.label,
          subtitle: `${m.status}${m.due_date ? ` - due ${fmt(m.due_date)}` : ""}`,
          module: "risk" as ModuleKey,
          id: m.id,
        })),
      ];
      const recActions = [
        "Confirm the current position.",
        r.risk_title.toLowerCase().includes("filing")
          ? "File the outstanding submission and save evidence."
          : "Complete the highest-priority mitigation.",
        "Enable automated reminders where available.",
        "Review this risk once the mitigating action is complete.",
      ];
      const content = [
        `${r.risk_title}. ${r.description}`,
        `Why it matters - ${r.consequence}`,
        `Recorded position: inherent ${r.likelihood}×${r.impact} = ${r.inherent_score} (${ratingLabel(r.inherent_score)}), residual ${r.residual_likelihood}×${r.residual_impact} = ${r.residual_score} (${ratingLabel(r.residual_score)}). Control effectiveness: ${r.control_effectiveness}.`,
        `Recommended actions: ${recActions.join(" ")}`,
        `Professional support: if the position, register status or possible enforcement action is unclear, seek help from an accountant, company secretary, solicitor or other appropriately qualified professional.`,
      ].join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "risk",
        reference_id: r.id,
        suggested_action: {
          label: "Open risk",
          kind: "navigate",
          target: `/risk?r=${r.id}`,
        },
        structured: {
          metric: {
            label: "Residual score",
            value: `${r.residual_score} (${ratingLabel(r.residual_score)})`,
          },
          items: [
            ...(linkedObl
              ? [
                  {
                    title: `Open obligation: ${linkedObl.title}`,
                    subtitle: `${linkedObl.regulator} - ${linkedObl.status}`,
                    module: "compliance" as ModuleKey,
                    id: linkedObl.id,
                  },
                ]
              : []),
            ...items,
          ],
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "obligation": {
      const o = state.compliance_obligations.find(
        (x) => x.id === ref.reference_id,
      );
      if (!o) return null;
      const content = [
        `${o.title} (${o.regulator}). ${o.plain_language_explanation || o.description}`,
        `Why it applies - ${o.reason_applies || "Recorded as applicable to this business."}`,
        `Status: ${o.status}${o.due_date ? ` - due ${fmt(o.due_date)}` : ""}. Required action: ${o.required_action || "-"}.`,
        o.professional_support_required
          ? "Professional support: seek qualified advice where the position is unclear."
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "obligation",
        reference_id: o.id,
        suggested_action: {
          label: "Open obligation",
          kind: "navigate",
          target: `/compliance?o=${o.id}`,
        },
        structured: {
          metric: { label: "Status", value: o.status },
          items: (o.required_evidence ?? []).map((e, i) => ({
            title: `Evidence: ${e}`,
            module: "compliance" as ModuleKey,
            id: `ev-${i}`,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "contract": {
      const c = state.contracts.find((x) => x.id === ref.reference_id);
      if (!c) return null;
      const issues = contractIssues(c);
      const content = [
        `${c.title} with ${c.counterparty}. Status: ${c.status}. ${c.end_date ? "Ends " + fmt(c.end_date) + "." : "No end date recorded."}`,
        `Value: ${c.value ? c.currency + " " + c.value.toLocaleString() : "not recorded"}. Owner: ${c.owner || "-"}.`,
        `Next action: ${c.next_action || "-"}${c.next_action_date ? ` (${fmt(c.next_action_date)})` : ""}.`,
        issues.length
          ? `Issues: ${issues.join("; ")}.`
          : "No outstanding issues detected.",
      ].join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "contract",
        reference_id: c.id,
        suggested_action: {
          label: "Open contract",
          kind: "navigate",
          target: `/contracts?c=${c.id}`,
        },
        structured: {
          metric: { label: "Risk", value: c.risk_level },
          items: issues.map((i, idx) => ({ title: i, id: `is-${idx}` })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "employee": {
      const e = state.employees.find((x) => x.id === ref.reference_id);
      if (!e) return null;
      const openActions = state.hr_actions.filter(
        (a) => a.employee_id === e.id && a.status === "open",
      );
      const content = [
        `${e.full_name} - ${e.job_title}, ${e.employment_status} (${e.employment_type}).`,
        `Right-to-work: ${e.right_to_work_status}. Training: ${e.training_status}. Handbook: ${e.policy_acknowledgement_status}. Contract: ${e.contract_status}.`,
        openActions.length
          ? `${openActions.length} open HR action(s).`
          : "No open HR actions.",
      ].join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "employee",
        reference_id: e.id,
        suggested_action: {
          label: "Open employee",
          kind: "navigate",
          target: `/hr?e=${e.id}`,
        },
        structured: {
          items: openActions.map((a) => ({
            title: a.title,
            subtitle: a.description,
            module: "hr" as ModuleKey,
            id: a.id,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "hr_action": {
      const a = state.hr_actions.find((x) => x.id === ref.reference_id);
      if (!a) return null;
      const e = state.employees.find((x) => x.id === a.employee_id);
      const content = [
        `${a.title}${e ? ` - ${e.full_name}` : ""}. ${a.description}`,
        `Status: ${a.status}${a.due_date ? ` - due ${fmt(a.due_date)}` : ""}. Priority: ${a.priority}.`,
        "Recommended: complete the action, record any evidence, then close it. Defer only with a documented reason.",
      ].join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "hr_action",
        reference_id: a.id,
        suggested_action: {
          label: "Open HR",
          kind: "navigate",
          target: e ? `/hr?e=${e.id}` : "/hr",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "entity": {
      const en = state.business_entities.find((x) => x.id === ref.reference_id);
      if (!en) return null;
      const c = en.contract_id
        ? state.contracts.find((x) => x.id === en.contract_id)
        : null;
      const content = [
        `${en.name} - ${en.entity_type} (${en.relationship}).`,
        `Status: ${en.status.replace("_", " ")}. Importance: ${en.importance}. Risk: ${en.risk_level}.`,
        c
          ? `Linked contract: ${c.title} (${c.status}).`
          : "No linked contract recorded.",
        en.notes ? `Notes: ${en.notes}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "entity",
        reference_id: en.id,
        suggested_action: {
          label: "Open relationship",
          kind: "navigate",
          target: `/business-map?e=${en.id}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "scenario": {
      const sc = state.scenario_runs.find((x) => x.id === ref.reference_id);
      if (!sc) return null;
      const res = sc.result;
      const content = [
        `${sc.scenario_name}. ${res.summary}`,
        `Readiness: ${res.readiness.replace("_", " ")}. Impact: ${res.impact_level}.`,
        res.required_actions.length
          ? `${res.required_actions.length} required action(s).`
          : "No required actions.",
        res.professional_support.length
          ? `Professional support suggested: ${res.professional_support.join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "scenario",
        reference_id: sc.id,
        suggested_action: {
          label: "Open scenario",
          kind: "navigate",
          target: `/simulator?s=${sc.id}`,
        },
        structured: {
          items: res.required_actions.map((a, i) => ({
            title: a.label,
            module: a.module,
            id: `ra-${i}`,
            subtitle: `${a.priority} priority`,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "report": {
      const r = state.reports.find((x) => x.id === ref.reference_id);
      if (!r) return null;
      return {
        sender: "jova",
        content: `${r.title}. ${r.summary}\n\nRecommended next: ${r.priority_actions[0] ?? "no immediate actions"}.`,
        reference_type: "report",
        reference_id: r.id,
        suggested_action: {
          label: "Open report",
          kind: "navigate",
          target: `/reports?r=${r.id}`,
        },
        structured: {
          items: r.priority_actions
            .slice(0, 6)
            .map((p, i) => ({ title: p, id: `pa-${i}` })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "governance": {
      const g = state.governance_records.find((x) => x.id === ref.reference_id);
      if (!g) return null;
      const content = [
        `${g.title} - ${g.record_type.replace("_", " ")}. Status: ${g.status}.`,
        g.description,
        g.decision ? `Decision: ${g.decision}.` : "",
        g.actions ? `Actions: ${g.actions}.` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "governance",
        reference_id: g.id,
        suggested_action: {
          label: "Open governance",
          kind: "navigate",
          target: `/governance?g=${g.id}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "data_request": {
      const d = state.data_requests.find((x) => x.id === ref.reference_id);
      if (!d) return null;
      return {
        sender: "jova",
        content: `${d.request_type} request (${d.requester_reference}). Received ${fmt(d.received_date)}, due ${fmt(d.due_date)}. Status: ${d.status}. Identity verified: ${d.identity_verified ? "yes" : "no"}.`,
        reference_type: "data_request",
        reference_id: d.id,
        suggested_action: {
          label: "Open GDPR",
          kind: "navigate",
          target: "/gdpr",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "breach": {
      const b = state.data_breaches.find((x) => x.id === ref.reference_id);
      if (!b) return null;
      return {
        sender: "jova",
        content: `${b.title}. ${b.description}\n\nRisk: ${b.risk_level}. Status: ${b.status}. ICO notification assessment: ${b.ico_notification_assessment || "-"}.`,
        reference_type: "breach",
        reference_id: b.id,
        suggested_action: {
          label: "Open GDPR",
          kind: "navigate",
          target: "/gdpr",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "dpia": {
      const d = state.dpias.find((x) => x.id === ref.reference_id);
      if (!d) return null;
      return {
        sender: "jova",
        content: `${d.title} - ${d.project}. Processing: ${d.processing_summary}\n\nResidual risk: ${d.residual_risk}. Status: ${d.status}.`,
        reference_type: "dpia",
        reference_id: d.id,
        suggested_action: {
          label: "Open GDPR",
          kind: "navigate",
          target: "/gdpr",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "activity": {
      const a = state.activities.find((x) => x.id === ref.reference_id);
      if (!a) return null;
      return {
        sender: "jova",
        content: `${a.title}. ${a.description}\n\nModule: ${a.module}. Status: ${a.status}. Priority: ${a.priority}${a.due_at ? ` - due ${fmt(a.due_at)}` : ""}.`,
        reference_type: "activity",
        reference_id: a.id,
        suggested_action: {
          label: `Open ${a.module}`,
          kind: "navigate",
          target: `/${a.module}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "dd_item": {
      const i = state.due_diligence_items.find(
        (x) => x.id === ref.reference_id,
      );
      if (!i) return null;
      const content = [
        `${i.title} (${categoryLabel(i.category)}). ${i.description}`,
        `Recorded status: ${ddStatusLabel(i.status)}. Priority: ${i.priority}. Owner: ${i.owner}.`,
        i.notes ? `Notes: ${i.notes}` : "",
        i.source_module ? `Linked to ${i.source_module}.` : "",
        "Recommended: complete or link the required evidence; mark ready once the record is in the data room.",
      ]
        .filter(Boolean)
        .join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "dd_item",
        reference_id: i.id,
        suggested_action: {
          label: "Open Investor Ready",
          kind: "navigate",
          target: `/investor-ready?dd=${i.id}`,
        },
        structured: {
          metric: { label: "Status", value: ddStatusLabel(i.status) },
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "data_room_item": {
      const d = state.data_room_items.find((x) => x.id === ref.reference_id);
      if (!d) return null;
      return {
        sender: "jova",
        content: `${d.title} in ${d.folder}. Status: ${d.status}. Version ${d.version}. Confidentiality: ${d.confidentiality}.`,
        reference_type: "data_room_item",
        reference_id: d.id,
        suggested_action: {
          label: "Open Data Room",
          kind: "navigate",
          target: `/investor-ready?dr=${d.id}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "investor_profile": {
      const p = state.investor_profiles.find((x) => x.id === ref.reference_id);
      if (!p) return null;
      return {
        sender: "jova",
        content: `Funding profile: ${p.funding_stage}, seeking ${p.currency} ${p.amount_sought.toLocaleString()} (${p.investment_type}). Purpose: ${p.funding_purpose}. Status: ${p.status}.`,
        reference_type: "investor_profile",
        reference_id: p.id,
        suggested_action: {
          label: "Open Investor Ready",
          kind: "navigate",
          target: "/investor-ready",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "tender_opportunity": {
      const o = state.tender_opportunities.find(
        (x) => x.id === ref.reference_id,
      );
      if (!o) return null;
      const reqs = state.tender_requirements.filter(
        (r) => r.opportunity_id === o.id,
      );
      const missingMandatory = reqs.filter(
        (r) =>
          r.mandatory &&
          r.status !== "complete" &&
          r.status !== "not_applicable",
      );
      const content = [
        `${o.title} (${o.authority}). ${o.summary}`,
        `Value ${o.currency} ${o.contract_value.toLocaleString()}. Deadline ${fmt(o.submission_deadline)}. Status: ${o.status}.`,
        `Recorded requirements: ${reqs.length}; ${missingMandatory.length} mandatory item(s) still to complete.`,
        "The final Bid / No Bid decision is yours to make.",
      ].join("\n\n");
      return {
        sender: "jova",
        content,
        reference_type: "tender_opportunity",
        reference_id: o.id,
        suggested_action: {
          label: "Open opportunity",
          kind: "navigate",
          target: `/tender-ready?o=${o.id}`,
        },
        structured: {
          items: missingMandatory.slice(0, 6).map((r) => ({
            title: r.title,
            subtitle: reqStatusLabel(r.status),
            module: "tender-ready" as ModuleKey,
            id: r.id,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    case "tender_requirement": {
      const r = state.tender_requirements.find(
        (x) => x.id === ref.reference_id,
      );
      if (!r) return null;
      return {
        sender: "jova",
        content: `${r.title}. ${r.description}\n\nType: ${r.requirement_type}. Mandatory: ${r.mandatory ? "yes" : "no"}. Weighting: ${r.weighting}. Status: ${reqStatusLabel(r.status)}. Evidence: ${r.evidence_reference || "-"}.`,
        reference_type: "tender_requirement",
        reference_id: r.id,
        suggested_action: {
          label: "Open tender",
          kind: "navigate",
          target: `/tender-ready?o=${r.opportunity_id}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "course": {
      const c = getCourse(ref.reference_id);
      if (!c) return null;
      // Always return the richer plain-English explanation for course
      // references so that both "Explain <course>" prompts and clicks on a
      // course reference produce a meaningful learner explanation, not just
      // a metadata card. Metadata is preserved as a short summary line.
      return academyCourseExplainReply(state, c);
    }
    case "assignment": {
      const a = state.academy_assignments.find(
        (x) => x.id === ref.reference_id,
      );
      if (!a) return null;
      const c = getCourse(a.course_id);
      return {
        sender: "jova",
        content: `${a.learner_name} - ${c?.title ?? a.course_id}. Status: ${a.status}${a.due_date ? ` - due ${fmt(a.due_date)}` : ""}. ${a.reason ?? ""}`,
        reference_type: "assignment",
        reference_id: a.id,
        suggested_action: {
          label: "Open Team Training",
          kind: "navigate",
          target: "/academy?tab=team",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "certificate": {
      const c = state.academy_certificates.find(
        (x) => x.id === ref.reference_id,
      );
      if (!c) return null;
      return {
        sender: "jova",
        content: `Certificate ${c.reference} - ${c.learner_name} completed ${c.course_title} on ${fmt(c.completed_at)} with quiz score ${c.quiz_score}%.`,
        reference_type: "certificate",
        reference_id: c.id,
        suggested_action: {
          label: "Open certificate",
          kind: "navigate",
          target: `/academy?tab=certificates&cert=${c.id}`,
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    case "academy_lesson": {
      return academyLessonReply(state, ref.reference_id, _prompt);
    }
    default:
      return null;
  }
}

const ESCALATION_KEYWORDS = [
  "sue",
  "lawsuit",
  "litigation",
  "dismiss",
  "fire an employee",
  "immigration",
  "visa",
  "tribunal",
  "tax avoidance",
  "dispute a contract",
];

function has(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w));
}

// --- Topic follow-ups ---------------------------------------------------

type Topic =
  | "investor"
  | "tender"
  | "risk"
  | "compliance"
  | "contract"
  | "hr"
  | "gdpr"
  | "governance"
  | "scenario"
  | "report"
  | "academy";

function topicFromRef(refType: string | null | undefined): Topic | null {
  switch (refType) {
    case "investor_profile":
    case "dd_item":
    case "data_room_item":
      return "investor";
    case "tender_opportunity":
    case "tender_requirement":
      return "tender";
    case "risk":
      return "risk";
    case "obligation":
      return "compliance";
    case "contract":
      return "contract";
    case "employee":
    case "hr_action":
      return "hr";
    case "data_request":
    case "breach":
    case "dpia":
      return "gdpr";
    case "governance":
      return "governance";
    case "scenario":
      return "scenario";
    case "report":
      return "report";
    case "course":
    case "assignment":
    case "certificate":
    case "academy_lesson":
      return "academy";
    default:
      return null;
  }
}

// User is clearly changing subject if the prompt names another module/topic.
function detectTopicSwitch(text: string): Topic | null {
  // Case-insensitive; normalise curly apostrophes.
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  // Only route to the Academy overview handler when the prompt is clearly about
  // Academy status/progress. Generic words like "lesson", "course", "training"
  // or a course topic ("gdpr") must never override an explicit lesson action
  // ("explain", "summarise") on an active lesson conversation.
  if (ACADEMY_OVERVIEW_RE.test(t)) return "academy";
  // Tender takes precedence when the prompt is clearly about a tender/bid,
  // even if the word "contract" appears (e.g. "tender contract opportunity").
  const tenderRe =
    /(tenders?|tender ready|tender readiness|procurement|procurement ready|\bbid(s|ding)?\b|bid ready|bid readiness|bid.?no.?bid|no.?bid|opportunit(y|ies)|contract opportunit|framework|quotation|submissions?|tender submission|bid submission|requirements?|evidence library|tender evidence|tender deadline|clarification deadline|method statement|social value|mobilisation|pricing schedule)/;
  const investorRe =
    /(investors?|investment( ready| readiness)?|investor ready|investor readiness|funding( round| profile)?|fundraising|raising|(?<!office )\braise\b|due.?diligence|diligence|data room|investment documents?|pitch deck|ownership information|shareholder information)/;
  if (tenderRe.test(t)) return "tender";
  if (investorRe.test(t)) return "investor";
  if (/(contracts?|renewals?|counterparty|supplier agreement)/.test(t))
    return "contract";
  if (/(employees?|staff|right[- ]to[- ]work|handbook|\bhr\b)/.test(t))
    return "hr";
  if (
    /(gdpr|privacy|data protection|\bico\b|breach|dpia|subject access)/.test(t)
  )
    return "gdpr";
  if (/(governance|board|minutes|directors?|resolution|polic(y|ies))/.test(t))
    return "governance";
  if (/(risks?|mitigation)/.test(t)) return "risk";
  if (/(obligations?|filing|companies house|hmrc|\bvat\b|compliance)/.test(t))
    return "compliance";
  return null;
}

type Intent =
  | "readiness"
  | "missing"
  | "next"
  | "explain"
  | "serious"
  | "expire"
  | "notify"
  | "approve"
  | "bid"
  | "generic";

function detectIntent(text: string): Intent {
  const t = text.trim().toLowerCase().replace(/[’‘]/g, "'");
  if (
    /(should we bid|bid or not|bid.?no.?bid|can we bid|are we ready to bid)/.test(
      t,
    )
  )
    return "bid";
  if (
    /(are we ready|are we .* ready|can we (proceed|submit|approach|bid)|ready to (submit|bid|approach|apply)|can we approach investors|how ready are we|are we (tender|investor|investment|bid|procurement) ready|is (that|this|it) (good|ok|okay)|good enough|^ready\??$)/.test(
      t,
    )
  )
    return "readiness";
  if (
    /(what.*(missing|gaps?|incomplete|to complete|need(s|ed)? review|awaiting review)|which (ones|items|requirements|responses|documents|opportunit(y|ies))|what evidence|what documents|what.*(need|needs) attention|what am i missing|what.*to (finish|complete))/.test(
      t,
    )
  )
    return "missing";
  if (
    /(what should (we|i) do|what.?s next|do next|how do we fix|what needs (to be )?done|priorit|next step|next actions?|before (fundraising|submission|investors|approach))/.test(
      t,
    )
  )
    return "next";
  if (/(is (this|that) serious|how (bad|serious)|risky)/.test(t))
    return "serious";
  if (
    /(when.*(expire|end|due|deadline)|renewal date|expires?|next .* deadline|deadline)/.test(
      t,
    )
  )
    return "expire";
  if (/(do we need to (report|notify)|report to (ico|hmrc)|notify the)/.test(t))
    return "notify";
  if (/(can we approve|approve (it|this)|sign this off)/.test(t))
    return "approve";
  if (
    /^(why\??|explain (that|this|it)|show me|tell me more)$|^(why\??|explain (that|this|it))\b/.test(
      t,
    )
  )
    return "explain";
  return "generic";
}

function isShortFollowUp(text: string): boolean {
  return text.trim().length <= 60;
}

function investorReadinessReply(state: CoreDataState): Draft {
  const m = investorReadinessMetrics(state);
  const status =
    m.overallScore >= 80
      ? "Ready"
      : m.overallScore >= 60
        ? "Mostly ready"
        : m.overallScore >= 40
          ? "Needs work"
          : "Significant gaps";
  const categoryList = (
    Object.entries(m.categoryScores) as Array<[string, number]>
  )
    .map(([k, v]) => ({ key: k, label: categoryLabel(k as any), score: v }))
    .sort((a, b) => a.score - b.score);
  const strongest = [...categoryList].sort((a, b) => b.score - a.score)[0];
  const attention = categoryList.filter((c) => c.score < 80).slice(0, 6);
  const priorityItems = [...m.items]
    .filter(
      (i) =>
        i.status === "missing" ||
        i.status === "needs_review" ||
        i.status === "in_progress",
    )
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    )
    .slice(0, 10);
  const content = [
    `Investor Readiness Score: ${m.overallScore}/100 - ${status}. ${m.ready} ready, ${m.missing} missing, ${m.needsReview} to review, ${m.highPriorityGaps.length} high-priority gap(s). Data Room ${m.dataRoomComplete}% (${m.dataRoomReady} of ${m.dataRoomTotal} items ready).`,
    `Current position - the business is progressing but is not yet fully investor ready.`,
    strongest
      ? `Strongest area - ${strongest.label} at ${strongest.score}/100.`
      : "",
    attention.length
      ? `Areas requiring attention:\n${attention.map((c) => `• ${c.label}: ${c.score}/100`).join("\n")}`
      : "",
    `Recommended next steps - prioritise the high-priority items in your due-diligence register and complete the Data Room folders that are still open.`,
    `Completing these items strengthens investor readiness. It does not guarantee that the business will be ready for investment - investor decisions depend on many factors, including current market conditions and investor-specific criteria.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    sender: "jova",
    content,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Investor Ready",
      kind: "navigate",
      target: "/investor-ready",
    },
    structured: {
      metric: {
        label: "Investor Readiness",
        value: `${m.overallScore}/100 - ${status}`,
      },
      items: priorityItems.map((i) => ({
        title: i.title,
        subtitle: `${categoryLabel(i.category)} - ${ddStatusLabel(i.status)}`,
        module: "investor-ready" as ModuleKey,
        id: i.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function investorMissingReply(state: CoreDataState): Draft {
  const m = investorReadinessMetrics(state);
  const missing = m.items
    .filter((i) => i.status === "missing" || i.status === "needs_review")
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    );
  return {
    sender: "jova",
    content: missing.length
      ? `${m.missing} missing and ${m.needsReview} needing review. High-priority gaps: ${m.highPriorityGaps.length}. The most important items are listed below.`
      : "No missing or review items in the due-diligence register.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "View missing documents",
      kind: "navigate",
      target: "/investor-ready",
    },
    structured: {
      items: missing.slice(0, 10).map((i) => ({
        title: i.title,
        subtitle: `${categoryLabel(i.category)} - ${ddStatusLabel(i.status)} · ${i.priority}`,
        module: "investor-ready" as ModuleKey,
        id: i.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function investorNextReply(state: CoreDataState): Draft {
  const m = investorReadinessMetrics(state);
  const ranked = [...m.items]
    .filter((i) => i.status !== "ready" && i.status !== "not_applicable")
    .sort(
      (a, b) =>
        ({ high: 0, medium: 1, low: 2 })[a.priority] -
        { high: 0, medium: 1, low: 2 }[b.priority],
    )
    .slice(0, 10);
  return {
    sender: "jova",
    content: ranked.length
      ? `Prioritised next steps for investor readiness (highest priority first).`
      : "No open due-diligence items - the register is complete.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "View action plan",
      kind: "navigate",
      target: "/investor-ready",
    },
    structured: {
      items: ranked.map((i, idx) => ({
        title: `${idx + 1}. ${i.title}`,
        subtitle: `${categoryLabel(i.category)} - ${i.priority} priority`,
        module: "investor-ready" as ModuleKey,
        id: i.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function tenderReadinessReply(state: CoreDataState): Draft {
  const m = tenderReadinessMetrics(state);
  const status =
    m.readinessScore >= 80
      ? "Ready"
      : m.readinessScore >= 60
        ? "Mostly ready"
        : m.readinessScore >= 40
          ? "Needs work"
          : "Significant gaps";
  const blockers: string[] = [];
  if (m.requirementsIncomplete.length)
    blockers.push(
      `${m.requirementsIncomplete.length} requirement(s) still incomplete across active opportunities`,
    );
  if (m.evidenceMissing.length)
    blockers.push(`${m.evidenceMissing.length} evidence item(s) missing`);
  if (m.bidPending.length)
    blockers.push(
      `${m.bidPending.length} Bid/No Bid decision(s) still pending`,
    );
  if (m.upcomingDeadlines.length)
    blockers.push(
      `${m.upcomingDeadlines.length} deadline(s) fall within the next 30 days`,
    );
  if (m.responsesForReview.length)
    blockers.push(`${m.responsesForReview.length} response(s) awaiting review`);
  const nextActions = [
    m.bidPending.length ? "Complete the pending Bid/No Bid assessment." : null,
    m.upcomingDeadlines.length
      ? "Review the nearest submission deadlines."
      : null,
    m.requirementsIncomplete.length
      ? "Open incomplete mandatory requirements."
      : null,
    m.evidenceMissing.length ? "Resolve the missing evidence item(s)." : null,
    "Complete opportunity-specific responses.",
    "Complete the final submission checklist before recording an opportunity as ready.",
  ].filter(Boolean) as string[];
  const content = [
    `Tender Readiness Score: ${m.readinessScore}/100 - ${status}. Policies score ${m.policyScore}. Evidence score ${m.evidenceScore}.`,
    `General organisational readiness - the business has a ${status.toLowerCase()} tender-readiness foundation (${m.active.length} active opportunity(ies), ${m.bidPending.length} bid decision(s) pending, ${m.upcomingDeadlines.length} deadline(s) in the next 30 days).`,
    `Submission readiness - the business is not automatically ready to submit every opportunity, because each tender has its own mandatory requirements, evidence, deadlines and approval checklist.`,
    blockers.length
      ? `Current blockers:\n${blockers.map((b) => `• ${b}`).join("\n")}`
      : "No current blockers detected.",
    `Recommended next actions:\n${nextActions.map((a) => `• ${a}`).join("\n")}`,
  ].join("\n\n");
  return {
    sender: "jova",
    content,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Tender Ready",
      kind: "navigate",
      target: "/tender-ready",
    },
    structured: {
      metric: {
        label: "Tender Readiness",
        value: `${m.readinessScore}/100 - ${status}`,
      },
      items: m.active.slice(0, 6).map((o) => ({
        title: o.title,
        subtitle: `${o.authority} - ${o.status}${o.submission_deadline ? ` · deadline ${fmt(o.submission_deadline)}` : ""}`,
        module: "tender-ready" as ModuleKey,
        id: o.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function tenderMissingRequirementsReply(state: CoreDataState): Draft {
  const m = tenderReadinessMetrics(state);
  const items = m.requirementsIncomplete.slice(0, 10).map((r) => {
    const opp = state.tender_opportunities.find(
      (o) => o.id === r.opportunity_id,
    );
    return {
      title: r.title,
      subtitle: `${opp?.title ?? "Opportunity"} - ${reqStatusLabel(r.status)}`,
      module: "tender-ready" as ModuleKey,
      id: r.id,
    };
  });
  return {
    sender: "jova",
    content: `${m.requirementsIncomplete.length} tender requirement(s) still incomplete across active opportunities.`,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "View incomplete requirements",
      kind: "navigate",
      target: "/tender-ready",
    },
    structured: { items, disclaimer: DISCLAIMER },
  };
}

function tenderEvidenceReply(state: CoreDataState): Draft {
  const m = tenderReadinessMetrics(state);
  const items = m.evidenceMissing.slice(0, 10).map((r) => {
    const opp = state.tender_opportunities.find(
      (o) => o.id === r.opportunity_id,
    );
    return {
      title: r.title,
      subtitle: `${opp?.title ?? "Opportunity"} - evidence missing`,
      module: "tender-ready" as ModuleKey,
      id: r.id,
    };
  });
  return {
    sender: "jova",
    content: m.evidenceMissing.length
      ? `${m.evidenceMissing.length} tender requirement(s) are missing supporting evidence.`
      : "No missing tender evidence recorded against active opportunities.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "View missing evidence",
      kind: "navigate",
      target: "/tender-ready",
    },
    structured: { items, disclaimer: DISCLAIMER },
  };
}

function tenderDeadlineReply(state: CoreDataState): Draft {
  const m = tenderReadinessMetrics(state);
  const upcoming = [...m.upcomingDeadlines]
    .filter((o) => !!o.submission_deadline)
    .sort(
      (a, b) =>
        new Date(a.submission_deadline!).getTime() -
        new Date(b.submission_deadline!).getTime(),
    );
  const next = upcoming[0];
  return {
    sender: "jova",
    content: next
      ? `The next tender deadline is "${next.title}" (${next.authority}) on ${fmt(next.submission_deadline)}.`
      : "No tender deadlines in the next 30 days.",
    reference_type: next ? "tender_opportunity" : null,
    reference_id: next?.id ?? null,
    suggested_action: {
      label: "Open Tender Ready",
      kind: "navigate",
      target: "/tender-ready",
    },
    structured: {
      items: upcoming.slice(0, 6).map((o) => ({
        title: o.title,
        subtitle: `${o.authority} - deadline ${fmt(o.submission_deadline)}`,
        module: "tender-ready" as ModuleKey,
        id: o.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function tenderBidReply(state: CoreDataState): Draft {
  const m = tenderReadinessMetrics(state);
  if (m.bidPending.length === 1) {
    const o = m.bidPending[0];
    return {
      sender: "jova",
      content: `One Bid/No Bid assessment is pending: "${o.title}" (${o.authority}). The final Bid/No Bid decision is yours to make - Jova provides guidance, not the decision.`,
      reference_type: "tender_opportunity",
      reference_id: o.id,
      suggested_action: {
        label: "Open pending Bid/No Bid",
        kind: "navigate",
        target: `/tender-ready?o=${o.id}`,
      },
      structured: { disclaimer: DISCLAIMER },
    };
  }
  return {
    sender: "jova",
    content: m.bidPending.length
      ? `${m.bidPending.length} Bid/No Bid assessment(s) are pending. Open each to review scoring before recording a decision.`
      : "No Bid/No Bid decisions are currently pending.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Tender Ready",
      kind: "navigate",
      target: "/tender-ready",
    },
    structured: {
      items: m.bidPending.map((o) => ({
        title: o.title,
        subtitle: `${o.authority} - assessing`,
        module: "tender-ready" as ModuleKey,
        id: o.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

// If the prompt names a specific tender opportunity by title (or a distinctive
// portion of it), route to that opportunity's reference reply.
function findNamedOpportunity(state: CoreDataState, prompt: string) {
  const p = prompt.toLowerCase();
  const opps = state.tender_opportunities;
  // exact title contains
  for (const o of opps) {
    const title = o.title.toLowerCase();
    if (title && p.includes(title)) return o;
  }
  // token overlap: match if 2+ distinctive title words appear
  const stop = new Set([
    "the",
    "a",
    "an",
    "of",
    "for",
    "and",
    "to",
    "in",
    "on",
    "tender",
    "opportunity",
    "ready",
    "bid",
    "are",
    "we",
    "is",
    "should",
    "what",
    "which",
  ]);
  for (const o of opps) {
    const tokens = o.title
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3 && !stop.has(w));
    if (tokens.length === 0) continue;
    const hits = tokens.filter((w) => p.includes(w));
    if (hits.length >= 2) return o;
  }
  return null;
}

function tenderTopicReply(
  state: CoreDataState,
  prompt: string,
  intent: Intent,
): Draft {
  // Named opportunity → route to that opportunity's reference reply.
  const named = findNamedOpportunity(state, prompt);
  if (named) {
    const ref: JovaRef = {
      reference_type: "tender_opportunity",
      reference_id: named.id,
    };
    const r = replyForReference(state, ref, prompt);
    if (r) return r;
  }
  const t = prompt.toLowerCase();
  if (/evidence/.test(t)) return tenderEvidenceReply(state);
  if (intent === "missing") return tenderMissingRequirementsReply(state);
  if (intent === "expire") return tenderDeadlineReply(state);
  if (intent === "bid") return tenderBidReply(state);
  if (intent === "next") return tenderMissingRequirementsReply(state);
  return tenderReadinessReply(state);
}

function investorTopicReply(
  state: CoreDataState,
  prompt: string,
  intent: Intent,
): Draft {
  const t = prompt.toLowerCase();
  if (
    intent === "missing" ||
    /data room|documents?|evidence|diligence gaps?/.test(t)
  )
    return investorMissingReply(state);
  if (intent === "next") return investorNextReply(state);
  return investorReadinessReply(state);
}

// Ambiguous readiness detection. Matches "are we ready?", "am I ready?",
// "is the business ready?", "how ready are we?", "are we prepared?",
// "what should we do to be ready?", "what do we need before we are ready?"
// and the bare "ready?" - without naming a specific area.
const AMBIGUOUS_READINESS_RE =
  /(^\s*ready\??\s*$|\b(are|is)\s+(we|the\s+business|i)\b[^?]*\bready\b|\bam\s+i\b[^?]*\bready\b|\bhow\s+ready\s+(are|is)\b|\bare\s+we\s+prepared\b|\bwhat\s+(should|do)\s+(we|i)\s+(do|need)\b[^?]*\bready\b|\bwhat\s+do\s+we\s+need\s+before\b[^?]*\bready\b)/i;

function readinessClarifyReply(): Draft {
  return {
    sender: "jova",
    content:
      "Ready for what?\n\nI can assess several kinds of readiness using your current Jojan One records. Choose the area you mean.",
    reference_type: null,
    reference_id: null,
    suggested_action: null,
    structured: {
      choices: [
        { label: "Investor readiness", prompt: "How investor ready are we?" },
        { label: "Tender readiness", prompt: "How tender ready are we?" },
        {
          label: "Compliance position",
          prompt: "What is our compliance position?",
        },
        {
          label: "Data protection / GDPR readiness",
          prompt: "What is our GDPR readiness?",
        },
        {
          label: "Business confidence / overall position",
          prompt: "What is our Business Confidence Score?",
        },
      ],
      disclaimer: DISCLAIMER,
    },
  };
}

// --- Academy replies ---------------------------------------------------

function academyOverviewReply(state: CoreDataState): Draft {
  const m = academyMetrics(state);
  const recs = buildRecommendations(state).slice(0, 5);
  const content = [
    `Academy: ${m.completed} completion(s), ${m.inProgress} in progress, ${m.overdue} overdue, ${m.dueSoon} due soon. ${m.certificatesEarned} certificate(s) earned. Overall progress ${m.overallProgressPct}%.`,
    recs.length
      ? `Recommended courses based on current business gaps:`
      : "No new recommendations - every current business gap has a matching course already in the library.",
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    sender: "jova",
    content,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Academy",
      kind: "navigate",
      target: "/academy",
    },
    structured: {
      metric: { label: "Learning progress", value: `${m.overallProgressPct}%` },
      items: recs.map((r) => {
        const c = getCourse(r.course_id);
        return {
          title: c?.title ?? r.course_id,
          subtitle: `${r.priority} · ${r.reason}`,
          module: "academy" as ModuleKey,
          id: r.course_id,
        };
      }),
      disclaimer: DISCLAIMER,
    },
  };
}

function academyOverdueReply(state: CoreDataState): Draft {
  const overdue = state.academy_assignments.filter(isAssignmentOverdue);
  return {
    sender: "jova",
    content: overdue.length
      ? `${overdue.length} training assignment(s) are overdue.`
      : "No training is currently overdue.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Team Training",
      kind: "navigate",
      target: "/academy?tab=team",
    },
    structured: {
      items: overdue.slice(0, 10).map((a) => ({
        title: `${a.learner_name} - ${getCourse(a.course_id)?.title ?? a.course_id}`,
        subtitle: `Due ${fmt(a.due_date)}`,
        module: "academy" as ModuleKey,
        id: a.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function academyDueSoonReply(state: CoreDataState): Draft {
  const list = state.academy_assignments.filter((a) => isDueSoon(a, 30));
  return {
    sender: "jova",
    content: list.length
      ? `${list.length} training assignment(s) fall due within the next 30 days.`
      : "No training assignments are due in the next 30 days.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Team Training",
      kind: "navigate",
      target: "/academy?tab=team",
    },
    structured: {
      items: list.slice(0, 10).map((a) => ({
        title: `${a.learner_name} - ${getCourse(a.course_id)?.title ?? a.course_id}`,
        subtitle: `Due ${fmt(a.due_date)}`,
        module: "academy" as ModuleKey,
        id: a.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function academyRecommendReply(state: CoreDataState): Draft {
  const recs = buildRecommendations(state);
  return {
    sender: "jova",
    content: recs.length
      ? `The following courses are recommended based on current business gaps.`
      : "No new recommendations - every current business gap has a matching course already in the library.",
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Academy",
      kind: "navigate",
      target: "/academy?tab=library",
    },
    structured: {
      items: recs.map((r) => {
        const c = getCourse(r.course_id);
        return {
          title: c?.title ?? r.course_id,
          subtitle: `${r.priority} · ${r.reason} (source: ${r.source_module})`,
          module: "academy" as ModuleKey,
          id: r.course_id,
        };
      }),
      disclaimer: DISCLAIMER,
    },
  };
}

function academyPersonReply(
  state: CoreDataState,
  prompt: string,
): Draft | null {
  const t = prompt.toLowerCase();
  const learners = listLearners(state);
  // Match by first-name or full-name token overlap
  const matches = learners.filter((l) => {
    const parts = l.name.toLowerCase().split(/\s+/);
    return parts.some((p) => p.length >= 3 && t.includes(p));
  });
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    return {
      sender: "jova",
      content: `Multiple people match - which one did you mean?`,
      reference_type: null,
      reference_id: null,
      suggested_action: null,
      structured: {
        items: matches.map((l) => ({
          title: l.name,
          subtitle: l.role,
          module: "academy" as ModuleKey,
          id: l.id,
        })),
        disclaimer: DISCLAIMER,
      },
    };
  }
  const learner = matches[0];
  // Course reference if mentioned
  const courseHit = COURSES.find(
    (c) =>
      t.includes(c.title.toLowerCase().split(" ")[0]) &&
      c.tags.some((tag) => t.includes(tag)),
  );
  const assignments = state.academy_assignments.filter(
    (a) => a.learner_id === learner.id,
  );
  if (courseHit) {
    const cert = certificateFor(state, learner.id, courseHit.id);
    const attempt = bestAttempt(state, learner.id, courseHit.id);
    const prog = progressFor(state, learner.id, courseHit.id);
    const line = cert
      ? `${learner.name} completed ${courseHit.title} on ${fmt(cert.completed_at)} with a quiz score of ${cert.quiz_score}%. Certificate ${cert.reference}.`
      : prog
        ? `${learner.name} has started ${courseHit.title} - ${prog.lessons_completed.length}/${courseHit.lessons.length} lesson(s) complete${attempt ? `, best quiz score ${attempt.score}%` : ""}. No certificate yet.`
        : `No record that ${learner.name} has started ${courseHit.title}.`;
    return {
      sender: "jova",
      content: line,
      reference_type: "course",
      reference_id: courseHit.id,
      suggested_action: {
        label: "Open course",
        kind: "navigate",
        target: `/academy?c=${courseHit.id}`,
      },
      structured: { disclaimer: DISCLAIMER },
    };
  }
  const overdue = assignments.filter(isAssignmentOverdue).length;
  const completed = assignments.filter((a) => a.status === "completed").length;
  return {
    sender: "jova",
    content: `${learner.name} - ${assignments.length} assignment(s), ${completed} completed, ${overdue} overdue.`,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Team Training",
      kind: "navigate",
      target: "/academy?tab=team",
    },
    structured: {
      items: assignments.map((a) => ({
        title: getCourse(a.course_id)?.title ?? a.course_id,
        subtitle: `${a.status}${a.due_date ? ` - due ${fmt(a.due_date)}` : ""}`,
        module: "academy" as ModuleKey,
        id: a.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function academyComplianceQuestionReply(): Draft {
  return {
    sender: "jova",
    content:
      "Training can support awareness and provide useful evidence of learning, but it does not by itself establish legal or regulatory compliance. Where professional judgement is required, seek appropriately qualified support.",
    reference_type: null,
    reference_id: null,
    suggested_action: null,
    structured: { disclaimer: DISCLAIMER },
  };
}

// --- Academy lesson (structured Ask Jova context) ---
// Explicit lesson-action verbs - any of these means the user wants an answer
// about the active lesson (or a lesson clarification), NOT the Academy overview.
const LESSON_ACTION_RE =
  /\b(explain|summari[sz]e|summary|example|answer|question|simpler|simply|plain english|what does (this|it) mean|why was (this|that|my answer) (wrong|correct)|related record|linked record|which record|what module|linked module|takeaway|learned|recap)\b/i;

// Words that unambiguously mean the user wants the Academy overview /
// progress / recommendation view, not a lesson explanation.
const ACADEMY_OVERVIEW_RE =
  /(academy progress|learning progress|learning status|training status|completed courses?|overdue training|recommended courses?|team training|learning gap|who needs training|what training is due|what courses have i completed|why was this course recommended|assign(ed)? training|my (academy|learning) (status|progress)|certificates? (earned|on file|register)|assignment(s)? (list|register)?)/i;

function detectLessonAction(text: string): string | null {
  const t = text.toLowerCase();
  if (/(another example|different example|other example|give.*example)/.test(t))
    return "another_example";
  if (
    /(summari[sz]e|summary|recap|key ?takeaways?|what.*(i|we) learned|what did (i|we) learn)/.test(
      t,
    )
  )
    return "summarise_lesson";
  if (
    /(related record|which record|linked module|related module|which module|what module|linked record)/.test(
      t,
    )
  )
    return "related_record";
  if (
    /(explain simply|in plain english|plain english|simpler|simply|what does (this|it) mean|explain this lesson|explain the lesson|explain the [\w\-']+ lesson|explain (this|it|that)( more)?( simply)?|make it (simpler|simple))/.test(
      t,
    )
  )
    return "explain_simply";
  if (
    /(why was my answer|explain my answer|why (was )?that (wrong|correct)|explain (the )?answer)/.test(
      t,
    )
  )
    return "explain_answer";
  return null;
}

function firstParagraph(md: string): string {
  const cleaned = md.replace(/\*\*/g, "").replace(/^#+\s*/gm, "");
  const paras = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  // Skip heading-only first paragraph (short label lines)
  const useful = paras.find((p) => p.length > 60) ?? paras[0] ?? "";
  return useful.replace(/\s+/g, " ").trim();
}

const MODULE_ROUTE: Record<string, string> = {
  compliance: "/compliance",
  risk: "/risk",
  gdpr: "/gdpr",
  hr: "/hr",
  governance: "/governance",
  contracts: "/contracts",
  "business-map": "/business-map",
  "investor-ready": "/investor-ready",
  "tender-ready": "/tender-ready",
  academy: "/academy",
  dashboard: "/dashboard",
  simulator: "/simulator",
  reports: "/reports",
  timeline: "/timeline",
  executive: "/executive",
  jova: "/jova",
};

function academyLessonReply(
  state: CoreDataState,
  refId: string,
  prompt: string,
): Draft | null {
  const [courseId, lessonId, encodedAction] = refId.split("::");
  const c = getCourse(courseId);
  if (!c) return null;
  const lesson = c.lessons.find((l) => l.id === lessonId);
  if (!lesson) return null;
  const lessonIndex = c.lessons.findIndex((l) => l.id === lessonId);
  const openLesson = `/academy?c=${c.id}&l=${lessonIndex}`;
  const overrideAction = detectLessonAction(prompt);
  const action = overrideAction ?? encodedAction ?? "explain_simply";

  const relatedModule = c.source_module ?? "academy";
  const relatedTarget = MODULE_ROUTE[relatedModule] ?? "/academy";

  const base = {
    sender: "jova" as const,
    reference_type: "academy_lesson",
    reference_id: refId,
    structured: { disclaimer: DISCLAIMER },
  };

  if (action === "another_example") {
    const alt = alternativeLessonExample(c, lesson);
    const content = [
      `Illustrative example - ${alt}`,
      `This is a fictional small-business example only. Real situations depend on the facts and may need appropriately qualified support.`,
    ].join("\n\n");
    return {
      ...base,
      content,
      suggested_action: {
        label: "Open lesson",
        kind: "navigate",
        target: openLesson,
      },
    };
  }

  if (action === "related_record") {
    const label = relatedModule.replace(/-/g, " ");
    const content = [
      `The lesson "${lesson.title}" links most directly to the ${label} area of Jojan One, where you can review your live records.`,
      `If more than one area is relevant, use the top search to jump to a specific record. Where no matching record exists yet, start from the ${label} module.`,
    ].join("\n\n");
    return {
      ...base,
      content,
      suggested_action: {
        label: `Open ${label}`,
        kind: "navigate",
        target: relatedTarget,
      },
    };
  }

  if (action === "summarise_lesson") {
    const takeaways = lesson.recap?.takeaways ?? [];
    const content = [
      `Main point - ${lesson.objective}`,
      takeaways.length
        ? `Key takeaways:\n${takeaways
            .slice(0, 3)
            .map((t) => `• ${t}`)
            .join("\n")}`
        : "",
      lesson.recap?.common_mistake
        ? `Common mistake - ${lesson.recap.common_mistake}`
        : "",
      lesson.action
        ? `Practical action - ${lesson.action.title}: ${lesson.action.description}`
        : "",
      lesson.recap?.professional_support
        ? `Professional support - ${lesson.recap.professional_support}`
        : `Where the position is uncertain, seek appropriately qualified support.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    return {
      ...base,
      content,
      suggested_action: {
        label: "Open lesson",
        kind: "navigate",
        target: openLesson,
      },
    };
  }

  if (action === "explain_answer") {
    return {
      ...base,
      content:
        "I can only explain a knowledge-check or quiz answer after you have submitted the question. Submit your answer inside the lesson, then ask again and I'll walk through why it was strong or weak.",
      suggested_action: {
        label: "Open lesson",
        kind: "navigate",
        target: openLesson,
      },
    };
  }

  // explain_simply (default)
  const plain = firstParagraph(lesson.learn);
  const content = [
    `Lesson: ${lesson.title} - from "${c.title}".`,
    `In plain English - ${plain}`,
    lesson.example?.body ? `For example - ${lesson.example.body}` : "",
    lesson.action
      ? `A practical step - ${lesson.action.title}: ${lesson.action.description}`
      : "",
    lesson.recap?.professional_support
      ? `Professional support - ${lesson.recap.professional_support}`
      : `Where the position is uncertain, seek appropriately qualified support.`,
  ]
    .filter(Boolean)
    .join("\n\n");
  return {
    ...base,
    content,
    suggested_action: {
      label: "Open lesson",
      kind: "navigate",
      target: openLesson,
    },
  };
}

function alternativeLessonExample(
  course: Course,
  lesson: CourseLesson,
): string {
  // Deterministic pick from a small pool based on lesson.id hash, avoiding the seeded example wording.
  const pool = [
    `An 8-person Manchester marketing agency faced the same objective - "${lesson.objective}". They ${lesson.action?.title.toLowerCase() ?? "put a short written process in place"} and kept a dated note of what they did, so they could point to the process if a client or insurer ever asked.`,
    `A 4-person Bristol consultancy applied the lesson by scheduling a short quarterly review, updating their record and closing the loop with the person accountable. This kept "${lesson.title.toLowerCase()}" from slipping between team members.`,
    `A 12-person Edinburgh trade contractor treated the lesson as a first-Monday-of-the-month task. It took under 30 minutes and produced a defensible written record that later helped answer a supplier due-diligence questionnaire.`,
    `A 5-person Cardiff online retailer used the ${course.category.toLowerCase()} lesson to draft a one-page internal note. When a new starter joined, the note gave them everything they needed to follow the same process.`,
  ];
  const seed = Array.from(lesson.id + course.id).reduce<number>(
    (n, ch) => (n * 31 + ch.charCodeAt(0)) >>> 0,
    5381,
  );
  return pool[seed % pool.length];
}

function academyTopicReply(
  state: CoreDataState,
  prompt: string,
  intent: Intent,
): Draft {
  const t = prompt.toLowerCase();
  // If the user asked for a lesson-level action ("explain", "summarise", etc.)
  // but there is no active lesson context, ask which course/lesson they mean
  // instead of running the Academy overview.
  if (LESSON_ACTION_RE.test(prompt) && !ACADEMY_OVERVIEW_RE.test(prompt)) {
    return academyClarifyLessonReply(state, prompt);
  }
  if (
    /(does completing|does this make|are we compliant|does completing this make us)/.test(
      t,
    )
  )
    return academyComplianceQuestionReply();
  if (/overdue/.test(t)) return academyOverdueReply(state);
  if (/due (soon|this week|this month|in \d+)/.test(t) || intent === "expire")
    return academyDueSoonReply(state);
  if (
    /recommend|what should (i|we) learn|what should (i|we) do next|next|priorit/.test(
      t,
    ) ||
    intent === "next" ||
    intent === "missing"
  )
    return academyRecommendReply(state);
  // Person-scoped question
  const person = academyPersonReply(state, prompt);
  if (person) return person;
  // Named course lookup
  const cx = COURSES.find((c) => t.includes(c.title.toLowerCase()));
  if (cx) {
    const ref: JovaRef = { reference_type: "course", reference_id: cx.id };
    const r = replyForReference(state, ref, prompt);
    if (r) return r;
  }
  return academyOverviewReply(state);
}

// Ask the user to pick a course/lesson when a lesson-action prompt arrives
// without an active `academy_lesson` reference. If the prompt names a course
// topic (e.g. "GDPR") we list that course's lessons; otherwise we list
// matching courses (or the full catalog).
function academyClarifyLessonReply(
  state: CoreDataState,
  prompt: string,
): Draft {
  const t = prompt.toLowerCase();
  const tokens = t
    .split(/[^a-z0-9]+/)
    .filter(
      (w) =>
        w.length > 2 &&
        !/^(the|and|for|our|from|with|what|when|which|about|explain|lesson|course|academy|please|summari[sz]e|simply|example|answer|record|related|another|give|show)$/.test(
          w,
        ),
    );
  const scored = COURSES.map((c) => {
    const hay = (
      c.title +
      " " +
      c.category +
      " " +
      (c.short_description ?? "") +
      " " +
      c.objectives.join(" ")
    ).toLowerCase();
    const score = tokens.reduce((n, w) => (hay.includes(w) ? n + 1 : n), 0);
    return { c, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 1) {
    const c = scored[0].c;
    return {
      sender: "jova",
      content: `Which lesson from "${c.title}" would you like me to explain? Pick a lesson below and I'll give a plain-English explanation.`,
      reference_type: "course",
      reference_id: c.id,
      suggested_action: {
        label: "Open course",
        kind: "navigate",
        target: `/academy?c=${c.id}`,
      },
      structured: {
        items: c.lessons.map((l, i) => ({
          title: l.title,
          subtitle: l.objective,
          module: "academy" as ModuleKey,
          id: `${c.id}::${l.id}::${i}`,
        })),
        disclaimer: DISCLAIMER,
      },
    };
  }

  const list = (scored.length ? scored.map((s) => s.c) : COURSES).slice(0, 8);
  return {
    sender: "jova",
    content: scored.length
      ? `Several Academy courses match. Which one did you mean?`
      : `I can explain any Academy lesson - which course did you mean?`,
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Academy library",
      kind: "navigate",
      target: "/academy?tab=library",
    },
    structured: {
      items: list.map((c) => ({
        title: c.title,
        subtitle: c.category,
        module: "academy" as ModuleKey,
        id: c.id,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

function topicFollowUpReply(
  state: CoreDataState,
  topic: Topic,
  intent: Intent,
  ref: JovaRef,
): Draft | null {
  if (topic === "investor") {
    if (intent === "readiness" || intent === "explain" || intent === "generic")
      return investorReadinessReply(state);
    if (intent === "missing") return investorMissingReply(state);
    if (intent === "next") return investorNextReply(state);
  }
  if (topic === "tender") {
    if (
      intent === "readiness" ||
      intent === "bid" ||
      intent === "explain" ||
      intent === "generic"
    )
      return tenderReadinessReply(state);
    if (intent === "missing" || intent === "next") {
      const m = tenderReadinessMetrics(state);
      const items = m.requirementsIncomplete.slice(0, 10).map((r) => ({
        title: r.title,
        subtitle: reqStatusLabel(r.status),
        module: "tender-ready" as ModuleKey,
        id: r.id,
      }));
      return {
        sender: "jova",
        content: `${m.requirementsIncomplete.length} incomplete requirement(s) across active opportunities. The final Bid / No Bid decision is yours to make.`,
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Tender Ready",
          kind: "navigate",
          target: "/tender-ready",
        },
        structured: { items, disclaimer: DISCLAIMER },
      };
    }
  }
  if (topic === "academy") {
    return academyTopicReply(state, "", intent);
  }
  // For record-scoped topics (risk, obligation, contract, employee, gdpr, governance)
  // the record-specific reply already covers the intent-relevant fields. Return null
  // so generateJovaReply falls through to replyForReference for that ref.
  return null;
}

// --- Explicit Academy course/lesson resolver ---------------------------
// Aliases used to detect an explicit course name in a user prompt. Longest
// alias wins so "contract management" maps to Contract Management and
// "contractor status" maps to IR35 without collision.
const COURSE_ALIASES: Record<string, string[]> = {
  crs_gdpr_essentials: [
    "gdpr essentials for business owners",
    "gdpr essentials",
    "uk gdpr course",
    "uk gdpr",
    "data protection basics",
    "gdpr",
  ],
  crs_privacy_notice: [
    "privacy notice fundamentals",
    "website privacy notice",
    "privacy policy course",
    "privacy notice",
  ],
  crs_cyber_essentials: [
    "cyber security essentials",
    "cybersecurity essentials",
    "information security",
    "security training",
    "cyber security",
    "cybersecurity",
    "cyber course",
  ],
  crs_rtw: [
    "right to work checks",
    "right-to-work checks",
    "right to work training",
    "employee eligibility checks",
    "immigration checks",
    "right to work",
    "right-to-work",
    "rtw",
  ],
  crs_director_duties: [
    "director duties and good governance",
    "directors duties",
    "director duties",
    "governance course",
    "good governance",
  ],
  crs_risk_mgmt: [
    "practical risk management",
    "risk register training",
    "business risk course",
    "risk management",
    "risk course",
  ],
  crs_contract_mgmt: [
    "contract management and renewals",
    "contract management",
    "renewals training",
    "contract renewal",
    "contracts course",
  ],
  crs_ir35: [
    "contractor status and ir35 awareness",
    "off payroll working",
    "off-payroll working",
    "employment status",
    "contractor status",
    "ir35",
  ],
  crs_hs: [
    "health and safety for small businesses",
    "workplace safety",
    "health and safety",
    "safety course",
    "h&s",
  ],
  crs_tender_evidence: [
    "tender evidence and bid readiness",
    "procurement training",
    "bid readiness",
    "tender readiness",
    "tender course",
  ],
  crs_investor_dd: [
    "investor due-diligence fundamentals",
    "investor due diligence fundamentals",
    "investment readiness",
    "data-room training",
    "data room training",
    "investor readiness",
    "investor course",
  ],
  crs_breach_response: [
    "data breach response basics",
    "personal-data breach",
    "personal data breach",
    "data breach course",
    "gdpr incident",
    "breach response",
    "data breach",
  ],
};

// Small, opt-in lesson-topic aliases so "the phishing lesson" resolves to
// the correct Cyber Security lesson even though the lesson title does not
// literally contain the word.
const LESSON_ALIASES: Record<string, string[]> = {
  "crs_cyber_essentials::l1": [
    "phishing",
    "mfa",
    "multi factor",
    "multi-factor",
    "five controls",
    "controls",
    "patching",
    "backups",
  ],
  "crs_cyber_essentials::l2": [
    "hygiene",
    "passwords",
    "leavers",
    "admins",
    "admin",
  ],
  "crs_cyber_essentials::l3": ["incident response", "incident"],
  "crs_gdpr_essentials::l4": ["security", "breaches", "accountability"],
};

function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[-_/]/g, " ")
    .replace(/[^a-z0-9& ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLongestCourseAlias(
  text: string,
): { courseId: string; alias: string } | null {
  const padded = " " + normaliseText(text) + " ";
  let best: { courseId: string; alias: string; length: number } | null = null;
  for (const [courseId, aliases] of Object.entries(COURSE_ALIASES)) {
    for (const alias of aliases) {
      const needle = " " + normaliseText(alias) + " ";
      if (padded.includes(needle)) {
        if (!best || needle.length > best.length) {
          best = { courseId, alias, length: needle.length };
        }
      }
    }
  }
  return best ? { courseId: best.courseId, alias: best.alias } : null;
}

function resolveExplicitAcademyCourse(
  prompt: string,
  activeAcademy: boolean,
): { course: Course; alias: string } | null {
  const n = normaliseText(prompt);
  const hit = matchLongestCourseAlias(prompt);
  if (!hit) return null;
  const course = getCourse(hit.courseId);
  if (!course) return null;
  // Wording that signals a business/module question rather than an
  // Academy course lookup ("what tender evidence is currently missing?").
  const businessWord =
    /\b(missing|gaps?|overdue|our |for the tender|for the funding|for the investors?|for the contract|for the renewal|register|open items|whats open)\b/.test(
      n,
    );
  if (businessWord) return null;
  const academyWord =
    /\b(course|lesson|lessons|training|academy|quiz|quizzes|teach|teaches|learn about|learn more|study)\b/.test(
      n,
    );
  const canonical = normaliseText(course.title);
  const fullCanonicalMatch = (" " + n + " ").includes(" " + canonical + " ");
  if (academyWord) return { course, alias: hit.alias };
  if (fullCanonicalMatch) return { course, alias: hit.alias };
  if (activeAcademy) return { course, alias: hit.alias };
  return null;
}

function findLessonInCourse(
  course: Course,
  prompt: string,
): CourseLesson | null {
  const n = " " + normaliseText(prompt) + " ";
  let bestLesson: CourseLesson | null = null;
  let bestLength = 0;
  const consider = (lesson: CourseLesson, phrase: string) => {
    const needle = " " + normaliseText(phrase) + " ";
    if (needle.trim().length < 4) return;
    if (n.includes(needle)) {
      if (needle.length > bestLength) {
        bestLength = needle.length;
        bestLesson = lesson;
      }
    }
  };
  for (const lesson of course.lessons) {
    // Explicit aliases first.
    const aliases = LESSON_ALIASES[`${course.id}::${lesson.id}`] ?? [];
    for (const a of aliases) consider(lesson, a);
    // Then significant tokens from the lesson title.
    for (const w of normaliseText(lesson.title).split(" ")) {
      if (
        w.length >= 5 &&
        !/^(about|these|those|their|which|other|first|second|third|matter|matters)$/.test(
          w,
        )
      ) {
        consider(lesson, w);
      }
    }
  }
  return bestLesson;
}

function academyCourseLessonClarify(course: Course): Draft {
  return {
    sender: "jova",
    content: `Which ${course.title} lesson would you like me to explain? Pick a lesson below and I'll give a plain-English explanation.`,
    reference_type: "course",
    reference_id: course.id,
    suggested_action: {
      label: "Open course",
      kind: "navigate",
      target: `/academy?c=${course.id}`,
    },
    structured: {
      items: course.lessons.map((l, i) => ({
        title: l.title,
        subtitle: l.objective,
        module: "academy" as ModuleKey,
        id: `${course.id}::${l.id}::${i}`,
      })),
      disclaimer: DISCLAIMER,
    },
  };
}

export function generateJovaReply(
  state: CoreDataState,
  prompt: string,
  ref?: JovaRef,
): Draft {
  // Priority 1: explicit Academy course/lesson named in the newest message.
  // A named course must override any previously inherited course or lesson
  // context - e.g. an active GDPR lesson conversation must switch to Cyber
  // Security Essentials when the user types "Explain the Cyber security
  // lesson to me". Only wins over topic-switch logic when the wording is
  // Academy-shaped; business-shaped prompts ("what tender evidence is
  // missing?") still fall through to the business handlers below.
  {
    const activeAcademy = ref
      ? topicFromRef(ref.reference_type) === "academy"
      : false;
    const explicit = resolveExplicitAcademyCourse(prompt, activeAcademy);
    if (explicit) {
      const course = explicit.course;
      // Try to match a specific lesson named in the prompt.
      const lesson = findLessonInCourse(course, prompt);
      if (lesson) {
        const refId = `${course.id}::${lesson.id}::explain_simply`;
        const r = academyLessonReply(state, refId, prompt);
        if (r) return r;
      }
      // Generic lesson mention → clarify with this course's lesson list.
      if (/\blessons?\b/i.test(prompt)) {
        return academyCourseLessonClarify(course);
      }
      // Course-level request → course reply, replacing any stale ref.
      const courseReply = replyForReference(
        state,
        { reference_type: "course", reference_id: course.id },
        prompt,
      );
      if (courseReply) return courseReply;
    }
  }

  // Priority 2: no course named, but an active course/academy_lesson context
  // exists AND the prompt names a specific lesson within that course
  // (e.g. "Explain the phishing lesson" while active course = Cyber).
  if (ref && ref.reference_id) {
    const activeCourseId =
      ref.reference_type === "course"
        ? ref.reference_id
        : ref.reference_type === "academy_lesson"
          ? ref.reference_id.split("::")[0]
          : null;
    if (activeCourseId) {
      const activeCourse = getCourse(activeCourseId);
      if (activeCourse && /\blessons?\b/i.test(prompt)) {
        const lesson = findLessonInCourse(activeCourse, prompt);
        if (lesson) {
          const refId = `${activeCourse.id}::${lesson.id}::explain_simply`;
          const r = academyLessonReply(state, refId, prompt);
          if (r) return r;
        }
      }
    }
  }

  // Highest priority: explicit lesson-action follow-up on an active
  // `academy_lesson` conversation. Runs before topic-switch logic so that
  // words like "gdpr" or "lesson" in the prompt never override the active
  // lesson context.
  if (
    ref &&
    ref.reference_type === "academy_lesson" &&
    ref.reference_id &&
    LESSON_ACTION_RE.test(prompt)
  ) {
    const r = academyLessonReply(state, ref.reference_id, prompt);
    if (r) return r;
  }

  // Next priority: explicit lesson-action follow-up on an active `course`
  // reference - ask which lesson from that course, rather than falling
  // through to a generic course-metadata reply.
  if (
    ref &&
    ref.reference_type === "course" &&
    ref.reference_id &&
    LESSON_ACTION_RE.test(prompt) &&
    /\blesson\b/i.test(prompt)
  ) {
    const c = getCourse(ref.reference_id);
    if (c) {
      return {
        sender: "jova",
        content: `Which lesson from "${c.title}" would you like me to explain? Pick a lesson below.`,
        reference_type: "course",
        reference_id: c.id,
        suggested_action: {
          label: "Open course",
          kind: "navigate",
          target: `/academy?c=${c.id}`,
        },
        structured: {
          items: c.lessons.map((l, i) => ({
            title: l.title,
            subtitle: l.objective,
            module: "academy" as ModuleKey,
            id: `${c.id}::${l.id}::${i}`,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
  }

  // If the user is clearly changing subject, drop the inherited reference so the
  // keyword flow answers about the new topic instead of the previous record.
  let effectiveRef = ref;
  const switchedTopic = detectTopicSwitch(prompt);
  if (effectiveRef && effectiveRef.reference_type) {
    const currentTopic = topicFromRef(effectiveRef.reference_type);
    if (switchedTopic && switchedTopic !== currentTopic) {
      effectiveRef = undefined;
    }
  }

  // Structured Academy lesson context always wins over generic Academy topic
  // handling - an explicit "Explain simply" from a lesson must not fall back
  // to course-metadata or dashboard replies.
  if (
    effectiveRef &&
    effectiveRef.reference_type === "academy_lesson" &&
    effectiveRef.reference_id
  ) {
    const r = replyForReference(state, effectiveRef, prompt);
    if (r) return r;
  }

  // Explicit Growth-topic prompts always route to the Growth handlers, whether
  // they arrive as fresh questions, suggested prompts, contextual Ask Jova
  // flows, follow-ups, or topic switches inside an existing conversation.
  const intent = detectIntent(prompt);

  // Ambiguous readiness guard. If the user asks a bare "are we ready?"-style
  // question and neither the message nor the conversation context identifies
  // a specific readiness area, ask which kind of readiness they mean before
  // falling through to broad module keyword matching or the generic fallback.
  {
    const inheritedTopic =
      effectiveRef && effectiveRef.reference_type
        ? topicFromRef(effectiveRef.reference_type)
        : null;
    if (
      AMBIGUOUS_READINESS_RE.test(prompt) &&
      !switchedTopic &&
      !inheritedTopic
    ) {
      return readinessClarifyReply();
    }
  }

  if (switchedTopic === "tender")
    return tenderTopicReply(state, prompt, intent);
  if (switchedTopic === "investor")
    return investorTopicReply(state, prompt, intent);
  if (switchedTopic === "academy")
    return academyTopicReply(state, prompt, intent);

  // Context-aware follow-ups: if we have an inherited/attached reference and the
  // prompt is a short follow-up, answer at the topic level (e.g. "Are we ready?"
  // in an Investor Ready conversation) before falling back to the record reply.
  if (effectiveRef && effectiveRef.reference_id) {
    const topic = topicFromRef(effectiveRef.reference_type);
    if (topic && isShortFollowUp(prompt)) {
      const topicReply = topicFollowUpReply(state, topic, intent, effectiveRef);
      if (topicReply) return topicReply;
    }
    // Reference-first: answer about the specific linked record.
    const r = replyForReference(state, effectiveRef, prompt);
    if (r) return r;
  }
  const text = prompt.toLowerCase();
  const disclaimer =
    "Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.";

  if (has(text, ESCALATION_KEYWORDS)) {
    return {
      sender: "jova",
      content:
        "This question needs professional judgement. I can prepare a briefing pack of the relevant activity and documents, but you should speak to a qualified adviser before making a decision.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Timeline",
        kind: "navigate",
        target: "/timeline",
      },
      structured: { disclaimer },
    };
  }

  const snapshot = computeSnapshot(state);

  // Priorities / attention
  if (
    has(text, [
      "priority",
      "priorities",
      "attention today",
      "what needs",
      "today",
    ])
  ) {
    const items = topPriorities(state, 4).map((p) => ({
      title: p.title,
      subtitle: p.description,
      module: p.module,
      id: p.id,
    }));
    return {
      sender: "jova",
      content: `You have ${snapshot.open_priorities} open priorities. The most urgent items are listed below.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Timeline",
        kind: "navigate",
        target: "/timeline",
      },
      structured: {
        items,
        metric: {
          label: "Open priorities",
          value: String(snapshot.open_priorities),
        },
      },
    };
  }

  // Overdue
  if (has(text, ["overdue", "late", "missed"])) {
    const overdue = state.activities.filter((a) => isOverdue(a));
    return {
      sender: "jova",
      content:
        overdue.length === 0
          ? "Nothing is overdue right now. Well done - every tracked obligation is either completed or still within its window."
          : `You have ${overdue.length} overdue item${overdue.length === 1 ? "" : "s"}. The one that matters most is at the top of the list.`,
      reference_type: overdue[0]?.reference_type ?? null,
      reference_id: overdue[0]?.id ?? null,
      suggested_action: {
        label: "Open Timeline",
        kind: "navigate",
        target: "/timeline",
      },
      structured: {
        items: overdue.map((a) => ({
          title: a.title,
          subtitle: a.description,
          module: a.module,
          id: a.id,
        })),
        metric: { label: "Overdue", value: String(overdue.length) },
      },
    };
  }

  // Business Confidence Score
  if (
    has(text, [
      "confidence score",
      "score",
      "business confidence",
      "how am i doing",
    ])
  ) {
    return {
      sender: "jova",
      content: `Your Business Confidence Score is ${snapshot.score} out of 100 - ${snapshot.status_label}. ${snapshot.explanation}`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Dashboard",
        kind: "navigate",
        target: "/dashboard",
      },
      structured: {
        metric: { label: "Confidence Score", value: `${snapshot.score} / 100` },
        factors: snapshot.factors.map((f) => ({
          label: f.label,
          score: f.score,
          note: f.note,
        })),
      },
    };
  }

  // Timeline / recent activity
  if (
    has(text, [
      "timeline",
      "recent activity",
      "recent",
      "history",
      "summarise recent",
      "what happened",
    ])
  ) {
    const recent = [...state.activities]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 5);
    return {
      sender: "jova",
      content: `In the last few weeks you've completed ${snapshot.completed_this_month} activities this month across compliance, HR, governance and contracts. Here's the most recent activity.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Timeline",
        kind: "navigate",
        target: "/timeline",
      },
      structured: {
        items: recent.map((a) => ({
          title: a.title,
          subtitle: a.description,
          module: a.module,
          id: a.id,
        })),
      },
    };
  }

  // Reports
  if (has(text, ["report", "reports", "latest report"])) {
    const recent = [...state.reports]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 4);
    return {
      sender: "jova",
      content: `You have ${state.reports.length} saved reports. The most recent is "${recent[0]?.title ?? "-"}".`,
      reference_type: recent[0] ? "report" : null,
      reference_id: recent[0]?.id ?? null,
      suggested_action: {
        label: "Open Reports",
        kind: "navigate",
        target: "/reports",
      },
      structured: {
        items: recent.map((r) => ({
          title: r.title,
          subtitle: r.reporting_period,
          id: r.id,
        })),
      },
    };
  }

  // Executive summary
  if (
    has(text, [
      "executive",
      "executive overview",
      "executive summary",
      "board",
      "leadership",
    ])
  ) {
    return {
      sender: "jova",
      content: `Overall position: ${snapshot.status_label} (${snapshot.score}/100). ${snapshot.open_priorities} open priorities, ${snapshot.overdue_actions} overdue, ${snapshot.high_priority_risks} high-priority risk. I can generate a full Executive Report if you'd like.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Generate Executive Report",
        kind: "generate_report",
        target: "executive_summary",
      },
      structured: {
        metric: { label: "Confidence", value: `${snapshot.score}/100` },
      },
    };
  }

  // Area-specific
  const areaKeywords: Array<[ModuleKey, string[]]> = [
    ["compliance", ["compliance", "filing", "companies house", "hmrc", "vat"]],
    ["contracts", ["contract", "supplier", "renewal", "msa"]],
    ["gdpr", ["gdpr", "privacy", "data protection", "ico"]],
    ["hr", ["hr", "employee", "right to work", "handbook", "staff"]],
    ["governance", ["governance", "board", "minutes", "director"]],
    ["risk", ["risk", "risks", "insurance", "cyber", "continuity"]],
  ];

  // Contracts-specific answers
  if (has(text, ["renewal", "renewing", "renew"])) {
    const items = state.contracts
      .filter((c) => contractIsExpiring(c, 60))
      .map((c) => ({
        title: c.title,
        subtitle: `${c.counterparty} - ends ${c.end_date?.slice(0, 10) ?? "?"}`,
        module: "contracts" as ModuleKey,
        id: c.id,
      }));
    return {
      sender: "jova",
      content: items.length
        ? `${items.length} contract${items.length === 1 ? "" : "s"} are approaching renewal in the next 60 days.`
        : "No contract renewals in the next 60 days.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Contracts",
        kind: "navigate",
        target: "/contracts",
      },
      structured: { items },
    };
  }
  if (
    has(text, [
      "contracts need attention",
      "contract action",
      "which contracts",
      "overdue contract",
    ])
  ) {
    const issues = state.contracts
      .map((c) => ({ c, issues: contractIssues(c) }))
      .filter((x) => x.issues.length)
      .slice(0, 6);
    return {
      sender: "jova",
      content: issues.length
        ? `${issues.length} contracts have open issues - the most pressing are listed.`
        : "No contract issues detected.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Contracts",
        kind: "navigate",
        target: "/contracts",
      },
      structured: {
        items: issues.map((x) => ({
          title: x.c.title,
          subtitle: x.issues.join(" • "),
          module: "contracts",
          id: x.c.id,
        })),
      },
    };
  }

  // HR specifics
  if (has(text, ["right to work", "right-to-work", "rtw"])) {
    const list = state.employees.filter(
      (e) => e.right_to_work_status === "outstanding",
    );
    return {
      sender: "jova",
      content: list.length
        ? `${list.length} employee${list.length === 1 ? "" : "s"} need a right-to-work check recorded.`
        : "All right-to-work checks are recorded.",
      reference_type: null,
      reference_id: null,
      suggested_action: { label: "Open HR", kind: "navigate", target: "/hr" },
      structured: {
        items: list.map((e) => ({
          title: e.full_name,
          subtitle: e.job_title,
          module: "hr",
          id: e.id,
        })),
      },
    };
  }
  if (
    has(text, ["hr action", "outstanding action", "employees with outstanding"])
  ) {
    const open = openHrActions(state);
    return {
      sender: "jova",
      content: `${open.length} open HR action${open.length === 1 ? "" : "s"}.`,
      reference_type: null,
      reference_id: null,
      suggested_action: { label: "Open HR", kind: "navigate", target: "/hr" },
      structured: {
        items: open.slice(0, 6).map((a) => ({
          title: a.title,
          subtitle: a.description,
          module: "hr",
          id: a.id,
        })),
      },
    };
  }
  if (
    has(text, [
      "dependency",
      "dependencies",
      "suppliers present",
      "most dependent",
    ])
  ) {
    const suppliers = state.business_entities.filter(
      (e) => e.entity_type === "supplier" && e.importance === "high",
    );
    return {
      sender: "jova",
      content: `${suppliers.length} high-importance supplier${suppliers.length === 1 ? "" : "s"} identified as key dependencies.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Business Map",
        kind: "navigate",
        target: "/business-map",
      },
      structured: {
        items: suppliers.map((e) => ({
          title: e.name,
          subtitle: e.relationship,
          module: "business-map",
          id: e.id,
        })),
      },
    };
  }
  if (
    has(text, [
      "scenario",
      "simulation",
      "hiring simulation",
      "what did my",
      "saved scenario",
    ])
  ) {
    const runs = state.scenario_runs.slice(0, 5);
    return {
      sender: "jova",
      content: runs.length
        ? `You have ${state.scenario_runs.length} saved scenarios. The most recent is "${runs[0].scenario_name}".`
        : "No saved scenarios yet.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Simulator",
        kind: "navigate",
        target: "/simulator",
      },
      structured: {
        items: runs.map((r) => ({
          title: r.scenario_name,
          subtitle: r.result.summary,
          module: "simulator",
          id: r.id,
        })),
      },
    };
  }
  if (has(text, ["missing", "what am i missing", "gaps"])) {
    const em = employeeMetrics(state);
    const en = entityMetrics(state);
    const bits: string[] = [];
    if (em.rtw_outstanding)
      bits.push(`${em.rtw_outstanding} right-to-work check(s) outstanding`);
    if (em.training_due) bits.push(`${em.training_due} training action(s) due`);
    if (em.policy_missing)
      bits.push(`${em.policy_missing} policy acknowledgement(s) missing`);
    if (en.missing)
      bits.push(`${en.missing} relationship(s) with missing information`);
    return {
      sender: "jova",
      content: bits.length
        ? `Key gaps: ${bits.join("; ")}.`
        : "No obvious gaps in your Business modules.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Dashboard",
        kind: "navigate",
        target: "/dashboard",
      },
    };
  }
  if (
    has(text, [
      "summarise the business",
      "summarize the business",
      "business category",
      "what should i do next",
    ])
  ) {
    const em = employeeMetrics(state);
    const en = entityMetrics(state);
    return {
      sender: "jova",
      content: `Business snapshot: ${en.customers} customers, ${en.suppliers} suppliers, ${em.active} employees, ${em.contractors} contractors. ${em.open_actions} open HR actions and ${state.contracts.filter((c) => contractIsExpiring(c)).length} contract renewals coming up.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Business Map",
        kind: "navigate",
        target: "/business-map",
      },
    };
  }

  for (const [mod, kws] of areaKeywords) {
    if (has(text, kws)) {
      const items = state.activities.filter(
        (a) => a.module === mod && isOpen(a),
      );
      const area = state.areas.find((a) => a.module === mod);
      return {
        sender: "jova",
        content: area
          ? `${area.label}: ${area.summary} Top concern - ${area.top_concern}`
          : `Here's the current picture for ${mod}.`,
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: `Open ${area?.label ?? mod}`,
          kind: "navigate",
          target: `/${mod}`,
        },
        structured: {
          items: items.map((a) => ({
            title: a.title,
            subtitle: a.description,
            module: a.module,
            id: a.id,
          })),
          metric: area
            ? { label: `${area.label} score`, value: `${area.score}/100` }
            : undefined,
        },
      };
    }
  }

  // ---- Compliance & Governance ----
  if (
    has(text, [
      "obligation",
      "obligations",
      "evidence",
      "companies house overdue",
    ])
  ) {
    const om = obligationMetrics(state);
    const list = om.overdue.length ? om.overdue : om.actionRequired.slice(0, 6);
    return {
      sender: "jova",
      content: `${om.overdue.length} overdue and ${om.actionRequired.length} needing action. ${om.awaitingEvidence.length} obligation(s) awaiting evidence.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Compliance",
        kind: "navigate",
        target: "/compliance",
      },
      structured: {
        items: list.map((o) => ({
          title: o.title,
          subtitle: `${o.regulator} - ${o.status}`,
          module: "compliance",
          id: o.id,
        })),
      },
    };
  }
  if (
    has(text, [
      "gdpr gap",
      "readiness",
      "data protection gap",
      "processing activit",
      "ropa",
    ])
  ) {
    const gm = gdprMetrics(state);
    return {
      sender: "jova",
      content: `GDPR readiness ${gm.readiness}/100. ${gm.gaps.length} gap(s). ${gm.openRequests.length} open data request(s). ${gm.openBreaches.length} open breach(es).`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open GDPR",
        kind: "navigate",
        target: "/gdpr",
      },
      structured: {
        items: gm.gaps.map((g, i) => ({
          title: g,
          module: "gdpr" as ModuleKey,
          id: `gap-${i}`,
        })),
      },
    };
  }
  if (has(text, ["data request", "subject access", "sar"])) {
    const gm = gdprMetrics(state);
    return {
      sender: "jova",
      content: gm.openRequests.length
        ? `${gm.openRequests.length} open data request(s).`
        : "No open data requests.",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open GDPR",
        kind: "navigate",
        target: "/gdpr",
      },
      structured: {
        items: gm.openRequests.map((r) => ({
          title: r.requester_reference,
          subtitle: `${r.request_type} - due ${r.due_date.slice(0, 10)}`,
          module: "gdpr" as ModuleKey,
          id: r.id,
        })),
      },
    };
  }
  if (
    has(text, [
      "decision",
      "meeting",
      "minutes",
      "sign-off",
      "policies",
      "policy review",
    ])
  ) {
    const g = governanceMetrics(state);
    return {
      sender: "jova",
      content: `${g.pending.length} governance record(s) awaiting action. ${g.minutesPending.length} minutes awaiting sign-off. ${g.policiesDue.length} policy review(s) due.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Governance",
        kind: "navigate",
        target: "/governance",
      },
      structured: {
        items: [...g.pending, ...g.minutesPending].slice(0, 6).map((x) => ({
          title: x.title,
          subtitle: x.description,
          module: "governance" as ModuleKey,
          id: x.id,
        })),
      },
    };
  }
  if (
    has(text, [
      "highest risk",
      "biggest risk",
      "critical risk",
      "risks are highest",
      "mitigation",
    ])
  ) {
    const r = riskMetrics(state);
    const top = [...state.risks.filter((x) => x.status === "open")]
      .sort((a, b) => b.residual_score - a.residual_score)
      .slice(0, 5);
    return {
      sender: "jova",
      content: `${r.open.length} open risk(s); ${r.highResidual.length} rated high or critical residual. ${r.overdueMit.length} mitigation(s) overdue.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Risk",
        kind: "navigate",
        target: "/risk",
      },
      structured: {
        items: top.map((x) => ({
          title: x.risk_title,
          subtitle: `${x.residual_rating.toUpperCase()} residual - score ${x.residual_score}`,
          module: "risk" as ModuleKey,
          id: x.id,
        })),
      },
    };
  }

  // ---- Growth ----
  if (
    has(text, [
      "investor ready",
      "investor readiness",
      "how investor ready",
      "due diligence",
      "data room",
      "funding profile",
      "investor-readiness",
      "red flag",
      "before investors",
      "before speaking to investors",
    ])
  ) {
    const m = investorReadinessMetrics(state);
    const gaps = m.items
      .filter((i) => i.status === "missing" || i.status === "needs_review")
      .slice(0, 6);
    return {
      sender: "jova",
      content: `Investor Readiness ${m.overallScore}/100. ${m.ready} ready, ${m.missing} missing, ${m.needsReview} to review. Data room ${m.dataRoomComplete}%. High-priority gaps: ${m.highPriorityGaps.length}.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Investor Ready",
        kind: "navigate",
        target: "/investor-ready",
      },
      structured: {
        metric: { label: "Readiness", value: `${m.overallScore}/100` },
        items: gaps.map((g) => ({
          title: g.title,
          subtitle: `${categoryLabel(g.category)} - ${ddStatusLabel(g.status)}`,
          module: "investor-ready" as ModuleKey,
          id: g.id,
        })),
        disclaimer: DISCLAIMER,
      },
    };
  }
  if (
    has(text, [
      "tender ready",
      "tender readiness",
      "how tender ready",
      "bid",
      "no bid",
      "should we bid",
      "tender deadline",
      "tender opportunity",
      "which opportunities",
      "mandatory evidence",
      "before submission",
      "bid risks",
      "responses need review",
      "which requirements",
    ])
  ) {
    const m = tenderReadinessMetrics(state);
    const items = m.upcomingDeadlines.slice(0, 5).map((o) => ({
      title: o.title,
      subtitle: `Deadline ${fmt(o.submission_deadline)}`,
      module: "tender-ready" as ModuleKey,
      id: o.id,
    }));
    return {
      sender: "jova",
      content: `Tender Readiness ${m.readinessScore}/100. ${m.active.length} active opportunity(ies), ${m.upcomingDeadlines.length} deadline(s) in the next 30 days, ${m.requirementsIncomplete.length} requirement(s) incomplete, ${m.responsesForReview.length} response(s) awaiting review.`,
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Tender Ready",
        kind: "navigate",
        target: "/tender-ready",
      },
      structured: {
        metric: { label: "Readiness", value: `${m.readinessScore}/100` },
        items,
        disclaimer: DISCLAIMER,
      },
    };
  }

  // ---- Settings ----
  const SETTINGS_KEYWORDS = [
    "settings",
    "preferences",
    "business profile",
    "company details",
    "company number",
    "vat number",
    "users",
    "roles",
    "permissions",
    "notifications",
    "reports defaults",
    "report defaults",
    "display",
    "accessibility",
    "backup",
    "export data",
    "import data",
    "audit log",
    "system status",
    "connection status",
    "data storage",
    "reset data",
    "delete everything",
  ];
  if (has(text, SETTINGS_KEYWORDS)) {
    const s = state.app_settings;
    // Specific: "delete everything" - never perform, deep-link to reset flow.
    if (
      has(text, [
        "delete everything",
        "wipe",
        "reset everything",
        "clear all data",
      ])
    ) {
      return {
        sender: "jova",
        content:
          "I won't perform a destructive reset from chat. Removing all Jojan One data will delete every prototype record and cannot be undone from here. Open Data Management to review the exact scope and confirm.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Data Management",
          kind: "navigate",
          target: "/settings?section=data",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Backup
    if (has(text, ["back up", "backup", "export data", "export backup"])) {
      return {
        sender: "jova",
        content:
          "The Jojan One backup is a JSON download containing prototype data: business profile, settings, module records, timeline, reports metadata, Jova conversations, Academy records and notifications. It excludes passwords, secrets and tokens, and is not encrypted. I'll take you to Data Management - confirm the export there.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Data Management",
          kind: "navigate",
          target: "/settings?section=data",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Where is data stored
    if (
      has(text, [
        "where is our data",
        "where is data",
        "data stored",
        "data storage",
      ])
    ) {
      return {
        sender: "jova",
        content:
          "Prototype data is stored in this browser using localStorage. It is not yet connected to a production database. Clearing browser storage may remove it - export a backup first if that matters.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Data Management",
          kind: "navigate",
          target: "/settings?section=data",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Companies House / regulators connected?
    if (
      has(text, [
        "companies house",
        "hmrc connected",
        "ico connected",
        "is companies house connected",
        "regulatory monitoring",
      ])
    ) {
      return {
        sender: "jova",
        content:
          "No external regulators are connected in this prototype. Companies House, HMRC, ICO, tender portals and live regulatory monitoring are all shown as Not connected in System Information. Jojan One does not file, monitor or submit on your behalf yet.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open System Information",
          kind: "navigate",
          target: "/settings?section=system",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Company number
    if (has(text, ["company number", "our company number"])) {
      const cn = state.business_profile.company_number;
      return {
        sender: "jova",
        content: cn
          ? `Your saved company number is ${cn}. Format only - Jojan One does not verify Companies House records in this prototype.`
          : "No company number has been saved yet. You can add it in Business Profile.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Business Profile",
          kind: "navigate",
          target: "/settings?section=business",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Who has admin access
    if (
      has(text, [
        "admin access",
        "who has admin",
        "owners",
        "administrators",
        "users",
        "roles",
        "permissions",
      ])
    ) {
      const admins = state.app_users.filter(
        (u) => u.role === "owner_admin" && u.status === "active",
      );
      return {
        sender: "jova",
        content: admins.length
          ? `Active Owner/Admin users: ${admins.map((u) => u.full_name).join(", ")}. Access controls in this prototype demonstrate intended product behaviour; production access must be enforced server-side.`
          : "No active Owner/Admin users are recorded.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Users & Access",
          kind: "navigate",
          target: "/settings?section=access",
        },
        structured: {
          items: state.app_users.map((u) => ({
            title: u.full_name,
            subtitle: `${u.email} - ${u.role} · ${u.status}`,
            module: "settings" as ModuleKey,
            id: u.id,
          })),
          disclaimer: DISCLAIMER,
        },
      };
    }
    // Notifications / email
    if (has(text, ["email", "didn't receive", "did not receive", "no email"])) {
      return {
        sender: "jova",
        content:
          "Email delivery is not connected in this prototype - Jojan One never sent an email. In-app notifications work; you can adjust categories and timing in Notifications.",
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Notifications",
          kind: "navigate",
          target: "/settings?section=notifications",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Audit log
    if (has(text, ["audit log", "administrative history"])) {
      return {
        sender: "jova",
        content: `${state.audit_events.length} audit event(s) recorded in this browser. This is a prototype audit history, not an immutable production audit trail.`,
        reference_type: null,
        reference_id: null,
        suggested_action: {
          label: "Open Audit Log",
          kind: "navigate",
          target: "/settings?section=audit",
        },
        structured: { disclaimer: DISCLAIMER },
      };
    }
    // Default settings reply
    return {
      sender: "jova",
      content:
        "Settings let you manage the business profile, users and roles, Jova preferences, notifications, display, report defaults, backup and system information. Which area would you like to open?",
      reference_type: null,
      reference_id: null,
      suggested_action: {
        label: "Open Settings",
        kind: "navigate",
        target: "/settings",
      },
      structured: {
        items: [
          {
            title: "Business Profile",
            subtitle: "Identity, operation, regional",
            module: "settings" as ModuleKey,
            id: "business",
          },
          {
            title: "Users & Access",
            subtitle: `${state.app_users.length} prototype users`,
            module: "settings" as ModuleKey,
            id: "access",
          },
          {
            title: "Jova preferences",
            subtitle: `${s.jova.communication_style} · ${s.jova.explanation_level}`,
            module: "settings" as ModuleKey,
            id: "jova",
          },
          {
            title: "Notifications",
            subtitle: "In-app connected · email/push not connected",
            module: "settings" as ModuleKey,
            id: "notifications",
          },
          {
            title: "Data Management",
            subtitle: "Backup, import, reset",
            module: "settings" as ModuleKey,
            id: "data",
          },
          {
            title: "System Information",
            subtitle: "Environment and connection status",
            module: "settings" as ModuleKey,
            id: "system",
          },
        ],
        disclaimer: DISCLAIMER,
      },
    };
  }

  // Fallback
  return {
    sender: "jova",
    content:
      'I can help with your priorities, overdue work, Business Confidence Score, recent activity, reports and each business area. Try one of the suggested prompts, or ask something like "What is overdue?"',
    reference_type: null,
    reference_id: null,
    suggested_action: {
      label: "Open Dashboard",
      kind: "navigate",
      target: "/dashboard",
    },
  };
}

export const SUGGESTED_PROMPTS = [
  "What needs my attention today?",
  "Explain my Business Confidence Score.",
  "What is overdue?",
  "Summarise recent business activity.",
  "Which risks need attention?",
  "Generate an executive summary.",
  "Show my latest reports.",
  "Which contracts need attention?",
  "What is renewing soon?",
  "Who needs a right-to-work check?",
  "What HR actions are due?",
  "Which suppliers present the greatest dependency?",
  "Summarise the Business category.",
  "What obligations are overdue?",
  "What GDPR gaps remain?",
  "Which decisions are awaiting approval?",
  "Which risks are highest?",
  "Which policies need review?",
  "How investor ready are we?",
  "What is missing from the data room?",
  "How tender ready are we?",
  "Which tender deadlines are approaching?",
  "What training is overdue?",
  "What should we learn next?",
  "Which courses are recommended?",
  "Which certificates have we earned?",
];
