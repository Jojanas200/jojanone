import type { ModuleKey } from "./types";

// -----------------------------------------------------------------------------
// Rich lesson types (backward compatible with the legacy `body` field).
// -----------------------------------------------------------------------------

export type ScenarioStrength = "best" | "acceptable" | "risky" | "wrong";

export interface LessonScenarioOption {
  id: string;
  label: string;
  strength: ScenarioStrength;
  feedback: string;
}
export interface LessonScenario {
  prompt: string;
  options: LessonScenarioOption[];
}

export interface LessonCheckQuestion {
  id: string;
  kind: "single" | "truefalse" | "multi";
  question: string;
  options: string[];
  correct: number[];
  explanation: string;
}

export interface LessonAction {
  title: string;
  description: string;
  route?: string;
  routeSearch?: Record<string, string>;
  ask_jova?: string;
}

export interface LessonExample {
  business: string;
  body: string;
  why: string;
}

export interface LessonRecap {
  takeaways: string[];
  common_mistake: string;
  professional_support?: string;
  next_preview?: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  objective: string;
  learn: string;
  example: LessonExample;
  scenario: LessonScenario;
  action: LessonAction;
  checks: LessonCheckQuestion[];
  recap: LessonRecap;
  body?: string;
}

export interface CourseQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  learning_area?: string;
  explanation?: string;
  scenario?: boolean;
  // Optional content-safety metadata (dev-time only; not shown in UI).
  riskLevel?: "normal" | "sensitive" | "professional_judgement";
  sourceType?: "internal_training" | "statutory_summary" | "business_practice";
  reviewedDate?: string;
  reviewDueDate?: string;
  professionalSupportTrigger?: string;
  wordingNotes?: string;
}

export interface CourseResourceSection {
  heading: string;
  items: string[];
}
export interface CourseResource {
  title: string;
  intro?: string;
  sections: CourseResourceSection[];
}

export interface Course {
  id: string;
  title: string;
  category: string;
  short_description: string;
  objectives: string[];
  audience: string;
  difficulty: "beginner" | "intermediate";
  duration_minutes: number;
  lessons: CourseLesson[];
  quiz: CourseQuizQuestion[];
  tags: string[];
  source_module?: ModuleKey;
  resource?: CourseResource;
}

// -----------------------------------------------------------------------------
// Compact builders.
// -----------------------------------------------------------------------------

const opt = (
  id: string,
  label: string,
  strength: ScenarioStrength,
  feedback: string,
): LessonScenarioOption => ({ id, label, strength, feedback });
const check = (
  id: string,
  question: string,
  options: string[],
  correct: number[],
  explanation: string,
  kind: LessonCheckQuestion["kind"] = "single",
): LessonCheckQuestion => ({
  id,
  kind,
  question,
  options,
  correct,
  explanation,
});
const Q = (
  id: string,
  question: string,
  options: string[],
  correct_index: number,
  explanation: string,
  learning_area?: string,
  scenario = false,
): CourseQuizQuestion => ({
  id,
  question,
  options,
  correct_index,
  explanation,
  learning_area,
  scenario,
});
function lesson(l: Omit<CourseLesson, "body">): CourseLesson {
  return { ...l, body: `${l.objective}\n\n${l.learn}` };
}

// -----------------------------------------------------------------------------
// Shared strings.
// -----------------------------------------------------------------------------

export const ACADEMY_DISCLAIMER =
  "Jojan One Academy provides general business learning and records participation in its learning modules. Course completion does not constitute legal, tax, financial, HR or regulatory advice, an accredited qualification, or proof of compliance. Where professional judgement is required, seek appropriately qualified support.";

export const CERTIFICATE_STATEMENT =
  "This completion record confirms that the learner completed the Jojan One learning module and knowledge check shown above. It is not an accredited qualification and does not by itself demonstrate legal or regulatory compliance.";

export const RESOURCE_DISCLAIMER =
  "This Jojan One Academy resource is general business guidance for UK small businesses, not legal, tax, financial or regulatory advice, and is not an accredited or approved template. Where professional judgement is required, seek appropriately qualified support.";

export const JOVA_LEARNING_STATEMENT =
  "Jova provides business information and guidance, not legal advice. Where professional judgement is required, Jova will recommend expert support.";

// -----------------------------------------------------------------------------
// Enriched course catalogue.
// -----------------------------------------------------------------------------

export const COURSES: Course[] = [
  // ==========================================================================
  // A. GDPR Essentials for Business Owners
  // ==========================================================================
  {
    id: "crs_gdpr_essentials",
    title: "GDPR Essentials for Business Owners",
    category: "Data Protection",
    short_description:
      "Plain-English introduction to UK GDPR for small businesses.",
    objectives: [
      "Understand the core UK GDPR principles",
      "Identify a lawful basis for common processing",
      "Recognise when to seek professional data protection support",
    ],
    audience: "Business owners, managers and anyone handling personal data.",
    difficulty: "beginner",
    duration_minutes: 30,
    source_module: "gdpr",
    tags: ["gdpr", "privacy", "data protection", "ico"],
    lessons: [
      lesson({
        id: "l1",
        title: "Why UK GDPR matters",
        objective:
          "Recognise your data protection duties as a small business and where the biggest risks sit.",
        learn:
          "**Who UK GDPR applies to**\nAny business that decides how or why personal data is used is a data controller and must follow UK GDPR. Personal data means anything that identifies a living person: names, emails, phone numbers, employee records, CCTV, IP addresses.\n\n**Why this matters commercially**\nBuyers, insurers and investors expect basic evidence of data protection. Weak practices typically show up as unclear privacy notices, no record of processing, or unresolved data requests.\n\n**What good looks like**\n- A written privacy notice you can point to\n- A record of processing activities (ROPA)\n- A named person accountable for data protection\n- A simple log of data requests and any incidents",
        example: {
          business:
            "Fictional example - Fairhurst Interiors Ltd, a 6-person design studio in Leeds.",
          body: "Fairhurst collects client contact details, staff HR data and CCTV in the reception. When a new commercial client asks about their data practices, they can share a one-page privacy notice, a ROPA and the name of the owner as the data protection lead.",
          why: "Being able to answer these questions in a short call keeps deals moving.",
        },
        scenario: {
          prompt:
            "A prospective client asks who is responsible for data protection at your business. What is the strongest first response?",
          options: [
            opt(
              "a",
              "Send them a copy of your privacy notice and name the accountable person.",
              "best",
              "This is the strongest response. It shows there is documented accountability and a live notice - buyers usually accept this without follow-up.",
            ),
            opt(
              "b",
              "Reply that you follow GDPR and let them ask if they need more.",
              "risky",
              "Assurance without evidence often triggers a longer questionnaire. Buyers expect a documented answer.",
            ),
            opt(
              "c",
              "Ask them to complete an NDA before you answer.",
              "wrong",
              "The information they are asking for is not confidential - a privacy notice is public by design.",
            ),
          ],
        },
        action: {
          title: "Confirm your privacy notice",
          description:
            "Open GDPR in Jojan One and check that your privacy notice has a current review date and a named accountable person.",
          route: "/gdpr",
          ask_jova: "Explain UK GDPR in plain English for a small business.",
        },
        checks: [
          check(
            "c1",
            "Which of the following counts as personal data?",
            [
              "An employee's email address",
              "A limited company registration number",
              "A generic product code",
            ],
            [0],
            "Personal data must relate to a living, identifiable person. Company registration numbers relate to entities, not individuals.",
          ),
          check(
            "c2",
            "A data controller is the party that decides how and why personal data is used.",
            ["True", "False"],
            [0],
            "Correct. A processor only acts on the controller's instructions. Most small businesses are controllers for their own staff and customer data.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "You are a controller for any personal data you decide how to use.",
            "Buyers, insurers and investors expect basic documented evidence.",
            "A one-page notice, a ROPA and a named lead are the practical minimum.",
          ],
          common_mistake:
            "Assuming that only large companies must comply - the rules apply from the first employee or customer.",
          professional_support:
            "For international transfers, group companies or unusual processing, consult a qualified data protection adviser.",
          next_preview:
            "Next: the six principles that shape every good data decision.",
        },
      }),
      lesson({
        id: "l2",
        title: "The six principles and a lawful basis",
        objective:
          "Apply the six data protection principles and pick a defensible lawful basis for common processing.",
        learn:
          "**The six principles**\nLawfulness, fairness and transparency · Purpose limitation · Data minimisation · Accuracy · Storage limitation · Integrity and confidentiality.\n\n**Lawful bases in plain English**\nEvery processing activity needs one:\n- Contract - to fulfil an agreement with the person\n- Legal obligation - e.g. HMRC records\n- Vital interests - life-and-death situations\n- Public task - mainly public authorities\n- Legitimate interests - a real business need, balanced against the person\n- Consent - specific, informed, freely given, easy to withdraw\n\n**Practical rule of thumb**\nMarketing to consumers typically relies on consent. Delivering a paid service usually relies on contract. Recording safeguards in the workplace often relies on legitimate interests, documented in a short balancing note.",
        example: {
          business:
            "Fictional example - Northgate Coaching Ltd, a 3-person consultancy.",
          body: "Northgate uses contract as the basis for delivering coaching, legal obligation for payroll, and consent for its monthly newsletter with a one-click unsubscribe.",
          why: "Each activity maps to one clear basis, so answering a request becomes routine.",
        },
        scenario: {
          prompt:
            "You want to email all past clients about a new service. Which basis is most defensible?",
          options: [
            opt(
              "a",
              "Consent - because they are subscribers.",
              "acceptable",
              "Consent works if you have a clear opt-in on file for marketing. If not, do not rely on it.",
            ),
            opt(
              "b",
              "Legitimate interests - because they are past clients and there is a reasonable expectation.",
              "best",
              "Where past clients could reasonably expect similar marketing and you offer easy opt-out, legitimate interests is often the strongest basis for B2B contacts. Document a short balancing test.",
            ),
            opt(
              "c",
              "Contract - because they signed one previously.",
              "wrong",
              "The old contract does not extend to unrelated future marketing.",
            ),
          ],
        },
        action: {
          title: "Update your ROPA",
          description:
            "Add the lawful basis for each activity you rely on most this quarter (delivery, payroll, marketing).",
          route: "/gdpr",
          ask_jova:
            "Help me choose a lawful basis for marketing emails to previous customers.",
        },
        checks: [
          check(
            "c1",
            "Which is NOT a UK GDPR principle?",
            ["Data minimisation", "Storage limitation", "Maximum retention"],
            [2],
            "There is no 'maximum retention' principle. In fact, storage limitation says only keep data as long as needed.",
          ),
          check(
            "c2",
            "Select all that are lawful bases under UK GDPR.",
            ["Consent", "Legitimate interests", "Custom", "Contract"],
            [0, 1, 3],
            "Consent, legitimate interests and contract are three of the six bases. 'Custom' is not a lawful basis.",
            "multi",
          ),
        ],
        recap: {
          takeaways: [
            "Every activity needs one lawful basis, documented in your ROPA.",
            "Consent is not the answer to everything - often contract or legitimate interests fits better.",
            "Data minimisation reduces both risk and admin.",
          ],
          common_mistake:
            "Ticking 'consent' for everything, including activities where consent cannot realistically be withdrawn.",
          professional_support:
            "Special category data (health, biometrics, criminal offence data) needs extra care - take advice.",
          next_preview: "Next: handling individual rights and requests.",
        },
      }),
      lesson({
        id: "l3",
        title: "Individual rights and requests",
        objective:
          "Recognise a valid data request and respond in a defensible way.",
        learn:
          "**The main rights**\nAccess (SAR), rectification, erasure, restriction, objection, portability, and rights around automated decision-making.\n\n**Handling a request**\n1. Log it the day you receive it.\n2. Verify the requester's identity proportionately.\n3. Clarify the scope if the request is very wide.\n4. Respond within one calendar month - extendable by two months for complex requests.\n5. Explain any redactions.\n\n**What usually goes wrong**\nMissed deadlines, sending too much data, or forwarding the raw inbox without redaction.",
        example: {
          business:
            "Fictional example - a former employee of Brookford Care sends a Subject Access Request.",
          body: "Brookford acknowledges the request within a day, agrees the scope (their HR and email records), and delivers a redacted export within three weeks alongside a short covering note.",
          why: "A structured response is faster to produce and much easier to defend if challenged.",
        },
        scenario: {
          prompt:
            "A customer asks to have all their data erased. What is the strongest first step?",
          options: [
            opt(
              "a",
              "Delete every record immediately.",
              "risky",
              "You may still need to keep some records - for example, HMRC financial history. Assess before you delete.",
            ),
            opt(
              "b",
              "Log the request, verify identity, and assess whether legal or contractual retention obligations apply.",
              "best",
              "This is the right sequence. Erasure is not absolute - you must balance it against other legal duties before you act.",
            ),
            opt(
              "c",
              "Ignore the request unless they escalate.",
              "wrong",
              "Ignoring a valid request is itself a breach of their rights.",
            ),
          ],
        },
        action: {
          title: "Open Data Requests",
          description:
            "Check that every open request has an owner and a response deadline.",
          route: "/gdpr",
          ask_jova:
            "Walk me through handling a Subject Access Request end-to-end.",
        },
        checks: [
          check(
            "c1",
            "How long do you usually have to respond to a Subject Access Request?",
            ["7 days", "One calendar month", "Three months"],
            [1],
            "The default is one calendar month. It may be extended by up to two further months for complex requests, with reasons given to the individual.",
          ),
          check(
            "c2",
            "You must always delete personal data when someone asks you to.",
            ["True", "False"],
            [1],
            "False. Erasure is a qualified right - other legal duties (e.g. tax records) may require you to keep certain data.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Log every request the day it arrives.",
            "Verify identity proportionately - do not use it as a delay tactic.",
            "Explain redactions rather than hiding them.",
          ],
          common_mistake:
            "Sending an unredacted mailbox export that reveals third parties.",
          professional_support:
            "For criminal offence data, litigation risk or subject access from journalists, take advice before responding.",
          next_preview: "Next: security, breaches and when to escalate.",
        },
      }),
      lesson({
        id: "l4",
        title: "Security, breaches and accountability",
        objective:
          "Know the practical security expectations and how to recognise a reportable breach.",
        learn:
          "**Security is proportionate**\nUK GDPR expects security appropriate to the risk - not military-grade for a two-person business.\n\n**Baseline controls**\n- Multi-factor authentication for email and admin\n- Least-privilege access, reviewed when people change roles\n- Backups you have actually restored at least once\n- Written breach process everyone knows how to trigger\n\n**What counts as a breach**\nAny accidental or unlawful loss, disclosure, access to or destruction of personal data. If it is likely to cause a risk to individuals, the ICO must be notified within 72 hours.",
        example: {
          business:
            "Fictional example - Meadowbank Legal Services misfires a client update email to the wrong distribution list.",
          body: "Because MFA and a written breach process are already in place, the team contains the issue within 20 minutes, assesses the risk, records the incident, and notifies the affected clients the same day.",
          why: "Speed matters. A rehearsed process makes the difference between a minor incident and a reportable breach.",
        },
        scenario: {
          prompt:
            "You realise a spreadsheet with employee bank details was emailed to a supplier by mistake. What should you do first?",
          options: [
            opt(
              "a",
              "Ask the supplier to delete it and move on.",
              "risky",
              "Deletion by the recipient does not remove the risk fully and does not replace assessment and record-keeping.",
            ),
            opt(
              "b",
              "Log the incident, ask the supplier to confirm deletion in writing, assess risk to individuals and decide on ICO/individual notification.",
              "best",
              "This is the right sequence: contain, evidence, assess, decide.",
            ),
            opt(
              "c",
              "Wait to see if anyone complains before acting.",
              "wrong",
              "You have a duty to assess and record without waiting for a complaint.",
            ),
          ],
        },
        action: {
          title: "Review breach log",
          description:
            "Open GDPR › Breaches and confirm every incident this year has a decision noted (report / not report / lessons learned).",
          route: "/gdpr",
          ask_jova:
            "Help me decide whether a misdirected email is a reportable breach.",
        },
        checks: [
          check(
            "c1",
            "Where a personal-data breach is notifiable to the ICO, what is the usual reporting period?",
            [
              "Within 24 hours",
              "Within 72 hours of becoming aware of it, where feasible",
              "Within 30 days",
            ],
            [1],
            "Not every personal-data breach is reportable. Notification generally depends on the risk to people's rights and freedoms. Record and assess every incident promptly, and obtain qualified support where the notification decision is uncertain.",
          ),
          check(
            "c2",
            "Select the controls that reduce breach risk the most for a small business.",
            [
              "Multi-factor authentication",
              "Regular access review",
              "Free public wifi for staff",
              "Restored backups",
            ],
            [0, 1, 3],
            "MFA, access review and tested backups reduce risk most. Public wifi is a well-known extra risk.",
            "multi",
          ),
        ],
        recap: {
          takeaways: [
            "Security must be proportionate - but MFA and access review are non-negotiable.",
            "Log every incident, reportable or not.",
            "A rehearsed process is what makes response fast.",
          ],
          common_mistake:
            "Missing the 72-hour window because nobody was clear who owns the decision.",
          professional_support:
            "For ransomware, large-scale or special-category breaches, take specialist advice immediately.",
          next_preview:
            "You've completed the lesson series - take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "What is the usual response period for a Subject Access Request?",
        [
          "7 days",
          "Usually within one calendar month, with possible extensions in specific circumstances",
          "Three months",
        ],
        1,
        "The default is usually one calendar month. Complex or numerous requests may be extended by up to two further months, and other circumstances can affect what is appropriate. Where a request is unclear or sensitive, seek qualified data-protection support.",
        "Individual rights",
      ),
      Q(
        "q2",
        "Which is NOT a UK GDPR principle?",
        ["Data minimisation", "Accuracy", "Maximum retention"],
        2,
        "Storage limitation is the principle - not maximum retention.",
        "Principles",
      ),
      Q(
        "q3",
        "Who is the UK data protection regulator?",
        ["ICO", "FCA", "HMRC"],
        0,
        "The Information Commissioner's Office (ICO) enforces UK GDPR.",
        "Regulators",
      ),
      Q(
        "q4",
        "Every processing activity must have at least one lawful basis.",
        ["True", "False"],
        0,
        "Every activity needs a documented lawful basis - this is a core UK GDPR requirement.",
        "Lawful basis",
      ),
      Q(
        "q5",
        "A former customer asks for all their data. What is the strongest first step?",
        [
          "Delete immediately",
          "Log the request, verify identity, assess retention obligations",
          "Reply that GDPR doesn't cover them",
        ],
        1,
        "Log first, then verify, then balance erasure against other legal duties.",
        "Individual rights",
        true,
      ),
      Q(
        "q6",
        "Where a personal-data breach is notifiable to the ICO, what is the usual reporting period?",
        [
          "Within 24 hours",
          "Within 72 hours of becoming aware of it, where feasible",
          "Within 30 days",
        ],
        1,
        "Not every personal-data breach is reportable - notification generally depends on the risk to people's rights and freedoms. Assess promptly and take qualified advice where the decision is uncertain.",
        "Breaches",
      ),
      Q(
        "q7",
        "Which is the best choice of lawful basis for marketing emails to past B2B clients who could reasonably expect them?",
        [
          "Consent only",
          "Legitimate interests with documented balancing",
          "Legal obligation",
        ],
        1,
        "For B2B contacts with reasonable expectation and easy opt-out, legitimate interests is often the strongest.",
        "Lawful basis",
        true,
      ),
      Q(
        "q8",
        "Which option generally provides the strongest protection for an important business account?",
        [
          "A password only",
          "A password and multi-factor authentication",
          "One shared password used by the whole team",
        ],
        1,
        "Multi-factor authentication provides an additional layer of protection if a password is stolen. Whether a particular security measure is required depends on the system, information and level of risk, but MFA is a widely recommended control for important accounts.",
        "Security",
      ),
    ],
    resource: {
      title: "GDPR essentials checklist",
      intro: "A one-page starter for a small business owner. Not legal advice.",
      sections: [
        {
          heading: "Accountability",
          items: [
            "Named data protection lead",
            "Privacy notice published and reviewed in the last 12 months",
            "Record of processing activities (ROPA) up to date",
          ],
        },
        {
          heading: "Rights and requests",
          items: [
            "Written process for handling requests",
            "Log of every request received this year",
            "Deadlines tracked against each request",
          ],
        },
        {
          heading: "Security baseline",
          items: [
            "MFA on email and admin accounts",
            "Access reviewed on joiners, movers, leavers",
            "Backups tested in the last 12 months",
            "Written breach process everyone can trigger",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // B. Privacy Notice Fundamentals
  // ==========================================================================
  {
    id: "crs_privacy_notice",
    title: "Privacy Notice Fundamentals",
    category: "Data Protection",
    short_description: "Write and maintain a clear, compliant privacy notice.",
    objectives: [
      "Know what a privacy notice must contain",
      "Keep the notice up to date",
      "Signpost data subject rights",
    ],
    audience: "Owners, marketers and anyone maintaining a website.",
    difficulty: "beginner",
    duration_minutes: 22,
    source_module: "gdpr",
    tags: ["gdpr", "privacy notice", "website"],
    lessons: [
      lesson({
        id: "l1",
        title: "Purpose and audience",
        objective:
          "Explain why a privacy notice exists and who it is written for.",
        learn:
          "**Purpose**\nA privacy notice tells individuals what personal data you collect, why, how long you keep it, who you share it with, and their rights.\n\n**Audience**\nCustomers, prospects, employees, suppliers. Write it in plain English - not legalese.\n\n**Where it lives**\nLinked from every page footer, sign-up form and quotation. If a form collects data, the notice should be one click away.",
        example: {
          business:
            "Fictional example - Brookline Roofing, a 4-person trades business.",
          body: "Brookline links its notice from the site footer and the quote form. The notice says who they are, what data they collect from enquiries, how long they keep quotes (24 months) and how to opt out of follow-ups.",
          why: "Prospects can see how their enquiry will be handled before they submit it.",
        },
        scenario: {
          prompt:
            "You launch a new lead-generation form. Where should the privacy notice live?",
          options: [
            opt(
              "a",
              "Only in the site footer.",
              "risky",
              "Better than nothing, but the form itself should link to it.",
            ),
            opt(
              "b",
              "Linked from the form, the footer, and any confirmation email.",
              "best",
              "Transparency at the point of collection is the strongest position.",
            ),
            opt(
              "c",
              "Only sent by email after they submit.",
              "wrong",
              "By then the data is already collected - transparency needs to come first.",
            ),
          ],
        },
        action: {
          title: "Open Privacy Notice",
          description:
            "Confirm the notice is linked from every form that collects personal data.",
          route: "/gdpr",
          ask_jova: "What should a small business privacy notice include?",
        },
        checks: [
          check(
            "c1",
            "A privacy notice should be written in:",
            ["Formal legal language", "Plain English", "Bulleted terms only"],
            [1],
            "Plain English is a legal expectation - the notice must be understandable to the intended reader.",
          ),
          check(
            "c2",
            "It is acceptable to publish the notice only after data is collected.",
            ["True", "False"],
            [1],
            "Transparency must come before or at the point of collection.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "A notice explains what, why, how long, who with, and rights.",
            "Write it for the actual reader.",
            "Link from the point of collection, not just the footer.",
          ],
          common_mistake:
            "Copying another company's notice without checking it matches your actual processing.",
          next_preview: "Next: what a notice must contain in detail.",
        },
      }),
      lesson({
        id: "l2",
        title: "Required content",
        objective:
          "List the required elements of a UK GDPR-aligned privacy notice.",
        learn:
          "**What to include**\n- Who you are and how to contact you\n- What personal data you collect and from where\n- Why you collect it (purposes) and your lawful basis for each\n- Who you share it with, including processors and any international transfers\n- How long you keep it\n- The rights individuals have and how to complain to the ICO\n\n**Marketing and cookies**\nIf you market by email or use cookies beyond the strictly necessary, describe how consent works and how to withdraw it.",
        example: {
          business:
            "Fictional example - Ashford Fitness Studio adds a new online booking tool.",
          body: "The privacy notice is updated the same week to name the new processor, the categories of data shared, and the retention period for booking history.",
          why: "Adding processors without updating the notice is a common source of complaints and audit findings.",
        },
        scenario: {
          prompt:
            "Your notice currently lists your CRM but not your new email marketing tool. What should you do?",
          options: [
            opt(
              "a",
              "Update the notice to name the new processor.",
              "best",
              "Naming the processor and describing the transfer is the required and easiest fix.",
            ),
            opt(
              "b",
              "Wait for the annual review.",
              "risky",
              "Waiting means the notice is inaccurate now, which is itself an issue.",
            ),
            opt(
              "c",
              "Remove the CRM from the notice too, to keep it short.",
              "wrong",
              "Making the notice less accurate is the wrong direction.",
            ),
          ],
        },
        action: {
          title: "Refresh notice",
          description:
            "Open GDPR › Privacy Notice and confirm the processors listed match those in your ROPA and Contracts.",
          route: "/gdpr",
          ask_jova: "Give me a checklist for the content of a privacy notice.",
        },
        checks: [
          check(
            "c1",
            "Which of these must a privacy notice cover?",
            [
              "Lawful basis for each purpose",
              "The CEO's home address",
              "Every employee name",
            ],
            [0],
            "Lawful basis for each purpose is required content - the others are not.",
          ),
          check(
            "c2",
            "Select all that should be listed in a notice.",
            [
              "Retention periods",
              "Processors and international transfers",
              "Complaint route to the ICO",
              "Every device model used",
            ],
            [0, 1, 2],
            "Retention, processors/transfers, and complaint route are required. Device inventory is not.",
            "multi",
          ),
        ],
        recap: {
          takeaways: [
            "The notice is a fixed set of required elements.",
            "Update it when processors, purposes or retention change.",
            "Signpost the ICO complaint route.",
          ],
          common_mistake:
            "Leaving old processors in the notice after switching tools.",
          next_preview: "Next: keeping the notice current.",
        },
      }),
      lesson({
        id: "l3",
        title: "Keeping it current",
        objective:
          "Set up a lightweight review cycle so the notice never goes stale.",
        learn:
          "**Review triggers**\n- Annually, as a minimum\n- Any new tool, processor or data flow\n- Any new marketing channel or major website change\n- Any complaint or breach that suggests the notice is unclear\n\n**Version control**\nRecord the version number, publication date and reviewer initials on the notice itself. Archive the previous version so you can show what was in force at a given date.",
        example: {
          business: "Fictional example - Kilnfield Print rebuilds its website.",
          body: "As part of the launch checklist, the notice version is bumped, the previous version archived, and the review date reset for 12 months' time.",
          why: "Old notices continue to bind you for the period they were live - archiving protects both you and the customer.",
        },
        scenario: {
          prompt:
            "Your website was rebuilt last month but the notice still refers to old forms. What is the safest response?",
          options: [
            opt(
              "a",
              "Publish a corrected notice, bump the version, archive the previous version.",
              "best",
              "This is transparent and gives you an audit trail.",
            ),
            opt(
              "b",
              "Silently edit the live page.",
              "risky",
              "Silent edits erase the record of what people were shown.",
            ),
            opt(
              "c",
              "Leave it - no one has complained.",
              "wrong",
              "Inaccurate transparency is itself a compliance issue.",
            ),
          ],
        },
        action: {
          title: "Set next review",
          description:
            "Set a review date in the next 12 months and log a version bump.",
          route: "/gdpr",
          ask_jova: "What triggers a privacy notice review?",
        },
        checks: [
          check(
            "c1",
            "How often should you review a privacy notice, at minimum?",
            [
              "Never",
              "Every 5 years",
              "At least annually and after material change",
            ],
            [2],
            "Annual review is a widely accepted baseline; changes to processing should trigger an out-of-cycle review.",
          ),
          check(
            "c2",
            "Silently editing a live notice is fine as long as the content is accurate now.",
            ["True", "False"],
            [1],
            "Silent edits break the audit trail - always version and archive.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Review annually and on material change.",
            "Version and archive rather than silently editing.",
            "The website launch checklist should include the notice.",
          ],
          common_mistake: "Forgetting the notice during a website rebuild.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Which is required in a privacy notice?",
        [
          "List of every employee",
          "Purposes and lawful bases",
          "Board minutes",
        ],
        1,
        "Purposes and lawful bases are core required content.",
        "Content",
      ),
      Q(
        "q2",
        "How often should you review a privacy notice, at minimum?",
        [
          "Never",
          "Every 5 years",
          "At least annually and after material change",
        ],
        2,
        "Annual review plus event-driven reviews is the standard.",
        "Review",
      ),
      Q(
        "q3",
        "Individuals can complain to the ICO if their rights are ignored.",
        ["True", "False"],
        0,
        "The complaint route to the ICO must be signposted in the notice.",
        "Rights",
      ),
      Q(
        "q4",
        "You add a new email marketing tool. What is the strongest response?",
        [
          "Add the processor to the notice and ROPA",
          "Wait until annual review",
          "Only tell customers if asked",
        ],
        0,
        "Add the processor to the notice and ROPA the same week.",
        "Change control",
        true,
      ),
      Q(
        "q5",
        "A privacy notice should be written for:",
        ["Lawyers", "The people whose data it describes", "Search engines"],
        1,
        "Plain-English drafting for the affected individuals is a legal expectation.",
        "Audience",
      ),
      Q(
        "q6",
        "Which is NOT usually required in a UK privacy notice?",
        [
          "Retention periods",
          "Complaint route to the ICO",
          "A CEO home address",
        ],
        2,
        "A CEO home address is neither required nor appropriate.",
        "Content",
      ),
      Q(
        "q7",
        "Silent edits to a live notice are safe if the content is accurate now.",
        ["True", "False"],
        1,
        "Version and archive to keep an audit trail.",
        "Version control",
      ),
    ],
    resource: {
      title: "Privacy notice review checklist",
      sections: [
        {
          heading: "Content",
          items: [
            "Controller identity and contact",
            "Categories of data collected",
            "Purposes and lawful bases",
            "Processors and international transfers",
            "Retention periods",
            "Rights and ICO complaint route",
          ],
        },
        {
          heading: "Publication",
          items: [
            "Linked from footer of every page",
            "Linked from every form collecting data",
            "Linked from confirmation emails",
          ],
        },
        {
          heading: "Governance",
          items: [
            "Version number and date on the notice",
            "Previous version archived",
            "Next review date set",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // C. Cyber Security Essentials
  // ==========================================================================
  {
    id: "crs_cyber_essentials",
    title: "Cyber Security Essentials",
    category: "Cyber Security",
    short_description:
      "The five technical controls every small business should have.",
    objectives: [
      "Explain the five Cyber Essentials-style controls",
      "Apply MFA, patching and access control",
      "Respond to a suspected incident",
    ],
    audience: "Owners, IT leads and delivery teams.",
    difficulty: "beginner",
    duration_minutes: 32,
    source_module: "risk",
    tags: ["cyber", "security", "infosec", "mfa"],
    lessons: [
      lesson({
        id: "l1",
        title: "The five controls that block most attacks",
        objective:
          "Recognise the five controls that block the majority of common attacks against small businesses.",
        learn:
          "**The five controls**\n- Boundary firewalls / secure internet gateway\n- Secure configuration of devices and services\n- Access control based on least privilege\n- Malware protection\n- Patch / update management\n\n**Why they matter**\nMost real-world small business breaches come from missed updates, weak or reused passwords, and mis-configured cloud sharing - not exotic attacks.",
        example: {
          business:
            "Fictional example - Elmwood Accountancy, 7 staff, mostly cloud-based.",
          body: "Elmwood turned on MFA everywhere, moved admin access to a separate account, and set a 14-day patch window. Their broker reduced their cyber insurance excess as a result.",
          why: "Cyber insurance and buyer questionnaires increasingly ask about these exact controls.",
        },
        scenario: {
          prompt:
            "You have two hours to reduce cyber risk in your small business. Where should you start?",
          options: [
            opt(
              "a",
              "Rewrite your information security policy.",
              "risky",
              "Useful eventually, but does not directly reduce risk in two hours.",
            ),
            opt(
              "b",
              "Enable MFA everywhere and remove any admin access nobody needs.",
              "best",
              "MFA and least-privilege deliver the biggest immediate risk reduction.",
            ),
            opt(
              "c",
              "Install a new firewall appliance.",
              "acceptable",
              "Firewalls are one of the five controls, but on a mostly cloud stack MFA is a higher-value first move.",
            ),
          ],
        },
        action: {
          title: "Open Risk register",
          description:
            "Add or update a 'Cyber security controls' risk with owner, next review, and current control state.",
          route: "/risk",
          ask_jova:
            "Explain the five Cyber Essentials controls in plain English.",
        },
        checks: [
          check(
            "c1",
            "Which is one of the five Cyber Essentials-style controls?",
            ["Access control", "Payroll setup", "Board diversity"],
            [0],
            "Access control is one of the five. The others are not information security controls.",
          ),
          check(
            "c2",
            "Select all that reduce breach risk for a small business.",
            [
              "MFA",
              "Reused passwords",
              "Least-privilege access",
              "Regular patching",
            ],
            [0, 2, 3],
            "Reused passwords are a well-known risk - the others reduce risk substantially.",
            "multi",
          ),
        ],
        recap: {
          takeaways: [
            "Five controls block most real-world attacks.",
            "MFA and least-privilege deliver the biggest immediate wins.",
            "Buyers and insurers ask about these directly.",
          ],
          common_mistake:
            "Investing in policy documents without switching on the technical controls.",
          next_preview:
            "Next: everyday hygiene that keeps the controls working.",
        },
      }),
      lesson({
        id: "l2",
        title: "Everyday hygiene",
        objective:
          "Apply practical routines that keep the technical controls effective.",
        learn:
          "**Passwords and MFA**\nUnique passwords for every service, kept in a password manager. MFA on every account that supports it - especially email, admin and finance.\n\n**Phishing awareness**\nMost incidents start with a convincing email. Slow down invoices, cross-check banking changes on a known-good phone number.\n\n**Access hygiene**\nRemove leaver accounts within one working day. Review who has admin every quarter.",
        example: {
          business:
            "Fictional example - Rowan & Barrow Design almost pays a fake invoice from a 'supplier'.",
          body: "A junior team member notices the sort code changed and rings the real supplier on a known number. The payment is stopped.",
          why: "A simple call-back rule stops most invoice fraud.",
        },
        scenario: {
          prompt:
            "An email from a regular supplier requests a change of bank details. What is the strongest response?",
          options: [
            opt(
              "a",
              "Reply and confirm by email.",
              "wrong",
              "The email itself may be compromised - email confirmation gives no assurance.",
            ),
            opt(
              "b",
              "Call the supplier on a phone number you already hold to verify the change.",
              "best",
              "Out-of-band verification is the industry standard for banking changes.",
            ),
            opt(
              "c",
              "Update the details in your finance system straight away.",
              "wrong",
              "You may be paying an attacker.",
            ),
          ],
        },
        action: {
          title: "Review leavers and admins",
          description:
            "Open HR and confirm no leaver retains active accounts; confirm the current admin list is minimal.",
          route: "/hr",
          ask_jova: "How should we run a joiners-movers-leavers access review?",
        },
        checks: [
          check(
            "c1",
            "MFA should be enabled…",
            ["Only on payroll", "Wherever practical", "Never for staff"],
            [1],
            "MFA belongs on every account that supports it - email, admin and finance first.",
          ),
          check(
            "c2",
            "When should leaver accounts be removed?",
            ["Within one working day", "Within a month", "Only if requested"],
            [0],
            "One working day is the widely accepted expectation for a small business.",
          ),
        ],
        recap: {
          takeaways: [
            "Password managers + MFA is the standard baseline.",
            "Verify banking changes out of band, always.",
            "Access review is a small quarterly job that prevents big incidents.",
          ],
          common_mistake: "Sharing one admin account 'because it's easier'.",
          next_preview: "Next: what to do when something goes wrong.",
        },
      }),
      lesson({
        id: "l3",
        title: "Incident response",
        objective:
          "Trigger a proportionate response when an incident is suspected.",
        learn:
          "**A simple response plan**\n1. Contain - isolate affected devices/accounts.\n2. Assess - what data, how many people, what harm.\n3. Escalate - inform leadership and, where relevant, the DP lead.\n4. Notify - decide whether ICO/individuals/insurer/customers need to be told.\n5. Learn - record the lessons.\n\n**Insurance and suppliers**\nCall your cyber insurer early; many policies fund incident response. Preserve evidence before wiping devices.",
        example: {
          business:
            "Fictional example - Cheshire Roasters spots unusual sign-ins on its cloud accounts.",
          body: "The owner disables the account, forces password reset with MFA, exports logs, contacts the insurer and records the incident. No customer data was accessed, but the event is logged and reviewed at the next team meeting.",
          why: "Recording a near-miss builds capability for the next event.",
        },
        scenario: {
          prompt: "A laptop is stolen from a car. What should you do first?",
          options: [
            opt(
              "a",
              "Remote-wipe if possible, revoke sessions, log the incident, assess personal data exposure.",
              "best",
              "This is the correct sequence - technical containment first, then assessment.",
            ),
            opt(
              "b",
              "Wait until you know what data was on it.",
              "wrong",
              "You can start containment immediately; assessment happens in parallel.",
            ),
            opt(
              "c",
              "Buy a replacement laptop.",
              "acceptable",
              "Necessary later, but not the first response.",
            ),
          ],
        },
        action: {
          title: "Log incident response owner",
          description:
            "Open Governance and confirm someone is named as incident response owner.",
          route: "/governance",
          ask_jova:
            "Draft a short incident response plan for a small business.",
        },
        checks: [
          check(
            "c1",
            "First step when you suspect an incident:",
            [
              "Contain the affected accounts or devices",
              "Post about it on social media",
              "Wait for it to escalate",
            ],
            [0],
            "Containment first; assessment and notification follow.",
          ),
          check(
            "c2",
            "Cyber insurance often funds incident response support.",
            ["True", "False"],
            [0],
            "Many policies include specialist support - call the insurer early.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Contain, assess, escalate, notify, learn.",
            "Record near-misses, not just breaches.",
            "The insurer is often your fastest source of expert help.",
          ],
          common_mistake:
            "Wiping evidence before the insurer or specialist sees it.",
          professional_support:
            "For ransomware, extortion or suspected data theft, engage specialist incident response - do not try to handle alone.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Which is one of the five Cyber Essentials-style controls?",
        ["Access control", "Payroll setup", "Board diversity"],
        0,
        "Access control is one of the five.",
        "Controls",
      ),
      Q(
        "q2",
        "MFA should be enabled…",
        ["Only on payroll", "Wherever practical", "Never for staff"],
        1,
        "MFA belongs wherever it is supported.",
        "Hygiene",
      ),
      Q(
        "q3",
        "When should leaver accounts be removed?",
        ["Within one working day", "Within a month", "Only if requested"],
        0,
        "One working day is the standard.",
        "Hygiene",
      ),
      Q(
        "q4",
        "A supplier emails asking for a bank details change. Best response?",
        [
          "Reply by email to confirm",
          "Call the supplier on a known number to verify",
          "Update the details immediately",
        ],
        1,
        "Out-of-band verification is the industry standard.",
        "Fraud",
        true,
      ),
      Q(
        "q5",
        "First step on a suspected incident is:",
        ["Contain", "Announce publicly", "Wait and see"],
        0,
        "Contain first; assessment and notification follow.",
        "Response",
      ),
      Q(
        "q6",
        "Least-privilege access means:",
        [
          "Everyone gets admin",
          "People get only the access they need",
          "Only the owner gets access",
        ],
        1,
        "Least-privilege means only the access needed for the role.",
        "Access",
      ),
      Q(
        "q7",
        "Patch/update management should aim to apply critical updates:",
        ["Within a year", "Within roughly 14 days", "Never automatically"],
        1,
        "14 days is a widely used benchmark for critical updates.",
        "Patching",
      ),
      Q(
        "q8",
        "Cyber insurance usually offers no incident response support.",
        ["True", "False"],
        1,
        "Many policies include specialist incident response - check yours.",
        "Insurance",
      ),
    ],
    resource: {
      title: "Cyber essentials quick-start checklist",
      sections: [
        {
          heading: "Immediate wins",
          items: [
            "MFA on email, admin, finance",
            "Password manager rolled out",
            "Leaver checklist tested",
          ],
        },
        {
          heading: "Monthly",
          items: [
            "Patch window confirmed",
            "Backup restore tested",
            "Admin access review",
          ],
        },
        {
          heading: "If something goes wrong",
          items: [
            "Isolate affected accounts/devices",
            "Call cyber insurer",
            "Assess personal data exposure",
            "Record the incident and lessons",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // D. Right-to-Work Checks
  // ==========================================================================
  {
    id: "crs_rtw",
    title: "Right-to-Work Checks",
    category: "HR",
    short_description:
      "Complete compliant right-to-work checks for UK employees.",
    objectives: [
      "Know when and how a check must be done",
      "Record the evidence",
      "Recognise time-limited permission",
    ],
    audience: "Hiring managers and HR leads.",
    difficulty: "beginner",
    duration_minutes: 22,
    source_module: "hr",
    tags: ["hr", "right to work", "rtw", "immigration", "employment"],
    lessons: [
      lesson({
        id: "l1",
        title: "Why right-to-work checks matter",
        objective:
          "Understand the purpose of right-to-work checks and the cost of getting them wrong.",
        learn:
          "**Purpose**\nEmployers must not knowingly employ someone without the right to work in the UK. A compliant check gives the employer a statutory defence against civil penalties.\n\n**Timing**\nA check must be done before employment starts. Not the first day - before.\n\n**Consequences**\nCivil penalties can be substantial. In serious cases, criminal liability is possible.",
        example: {
          business:
            "Fictional example - Halston Cafe hires a new part-time barista.",
          body: "The owner does the RTW check before the first shift, keeps a dated copy on file, and diarises a re-check date because the permission is time-limited.",
          why: "Doing the check on day one, not before, is one of the most common small business errors.",
        },
        scenario: {
          prompt:
            "A candidate can start on Monday. Their documents will 'arrive later that week'. What is the strongest response?",
          options: [
            opt(
              "a",
              "Start them and complete the check within a week.",
              "wrong",
              "Employment must not start before the check is complete.",
            ),
            opt(
              "b",
              "Delay the start date until the check is complete.",
              "best",
              "This preserves the statutory defence and avoids penalty risk.",
            ),
            opt(
              "c",
              "Ask them to sign a declaration and start.",
              "wrong",
              "A self-declaration is not a substitute for a compliant check.",
            ),
          ],
        },
        action: {
          title: "Open HR",
          description:
            "Confirm every new starter this year has a dated RTW check on file.",
          route: "/hr",
          ask_jova: "When must a right-to-work check be completed?",
        },
        checks: [
          check(
            "c1",
            "A right-to-work check must be complete:",
            [
              "Within a week of starting",
              "Before employment starts",
              "Only if asked by HMRC",
            ],
            [1],
            "Before employment starts. This is what preserves the statutory defence.",
          ),
          check(
            "c2",
            "A self-declaration by the employee is a valid substitute for a documented check.",
            ["True", "False"],
            [1],
            "It is not - you need documented evidence.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Do the check before employment starts.",
            "The check gives you a statutory defence.",
            "Self-declarations are not enough.",
          ],
          common_mistake:
            "Starting someone 'on trust' and doing the check later.",
          next_preview: "Next: how to do the check and record it.",
        },
      }),
      lesson({
        id: "l2",
        title: "Doing and recording the check",
        objective:
          "Complete the check using accepted routes and record the evidence properly.",
        learn:
          "**Accepted routes (high level)**\n- Manual document check in person\n- Home Office online RTW service, where applicable\n- Identity verification via an Identity Service Provider for British/Irish citizens with a valid passport\n\n**Recording evidence**\nKeep a clear copy or share code result, dated and signed as checked, in the HR record. Retain for the duration of employment plus two years.\n\n**Non-discrimination**\nApply the same checks to every candidate. Do not select who gets checked based on appearance or nationality.",
        example: {
          business:
            "Fictional example - Broadstone Logistics hires drivers from a mix of backgrounds.",
          body: "They use the same checking process for every hire, record the check date and route, and diarise re-checks for anyone with time-limited permission.",
          why: "A consistent process protects both the business and the candidate.",
        },
        scenario: {
          prompt:
            "You only run RTW checks on candidates you 'aren't sure about'. What is wrong?",
          options: [
            opt(
              "a",
              "Nothing - it saves time.",
              "wrong",
              "Selective checking is potentially unlawful discrimination.",
            ),
            opt(
              "b",
              "It risks discrimination claims and undermines your statutory defence.",
              "best",
              "Apply the same process to every candidate.",
            ),
            opt(
              "c",
              "It's fine as long as you document it.",
              "wrong",
              "Documentation does not fix the underlying discrimination risk.",
            ),
          ],
        },
        action: {
          title: "Standardise the process",
          description:
            "Open HR and confirm your process states 'same check for every candidate'.",
          route: "/hr",
          ask_jova:
            "Give me a right-to-work checklist we can print for hiring managers.",
        },
        checks: [
          check(
            "c1",
            "How long should RTW evidence be retained?",
            [
              "Only during employment",
              "Duration of employment + 2 years",
              "10 years",
            ],
            [1],
            "The widely used standard is employment plus two years.",
          ),
          check(
            "c2",
            "Right-to-work checks should be:",
            [
              "Applied only to non-UK-looking candidates",
              "Applied consistently to every candidate",
              "Optional",
            ],
            [1],
            "Consistent application is the only non-discriminatory approach.",
          ),
        ],
        recap: {
          takeaways: [
            "Same check for every candidate.",
            "Record date, method and result.",
            "Retain evidence for the required period.",
          ],
          common_mistake: "Checking only some candidates.",
          professional_support:
            "Immigration status decisions can be complex - refer complex cases to a qualified immigration adviser.",
          next_preview: "Next: time-limited permission and re-checks.",
        },
      }),
      lesson({
        id: "l3",
        title: "Time-limited permission and re-checks",
        objective: "Diary and act on time-limited right to work.",
        learn:
          "**When a re-check is due**\nIf a person's right to work is time-limited, run a follow-up check before it expires. Do it early enough to allow for query resolution.\n\n**What to do if it expires**\nDo not continue employing someone whose right to work has expired without evidence of continuing permission. Take advice before terminating.",
        example: {
          business:
            "Fictional example - Portside Care employs a nurse with a time-limited visa.",
          body: "HR sets a re-check reminder 60 days before expiry, runs the online check, and updates the HR record and diary in one step.",
          why: "60 days gives time to resolve any evidence issue without a last-minute crisis.",
        },
        scenario: {
          prompt:
            "An employee's right to work expires next month. You have no updated evidence yet. What should you do?",
          options: [
            opt(
              "a",
              "Do nothing until it expires.",
              "wrong",
              "You risk employing someone without lawful permission.",
            ),
            opt(
              "b",
              "Contact the employee now, run the online check, and take advice if evidence is not forthcoming.",
              "best",
              "Early engagement gives everyone time to resolve the position.",
            ),
            opt(
              "c",
              "Terminate immediately.",
              "risky",
              "Termination without taking advice may create an unfair-dismissal risk.",
            ),
          ],
        },
        action: {
          title: "Open HR actions",
          description:
            "Confirm every time-limited right to work has a re-check reminder.",
          route: "/hr",
          ask_jova:
            "How should we plan a re-check for a time-limited right to work?",
        },
        checks: [
          check(
            "c1",
            "If a right to work is time-limited, you must:",
            [
              "Do nothing",
              "Re-check before it expires",
              "Dismiss the employee",
            ],
            [1],
            "Re-check before expiry - plan far enough ahead to resolve evidence issues.",
          ),
          check(
            "c2",
            "Termination without taking advice can create employment claim risk.",
            ["True", "False"],
            [0],
            "Yes - take advice before terminating for RTW reasons.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Diary re-checks well before expiry.",
            "Engage the employee early.",
            "Take advice before any termination.",
          ],
          common_mistake:
            "Realising the day of expiry that no re-check reminder was set.",
          professional_support:
            "Complex or borderline cases - engage a qualified immigration adviser and employment lawyer.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "How long should RTW evidence be retained?",
        [
          "Only during employment",
          "Duration of employment + 2 years",
          "10 years",
        ],
        1,
        "Employment plus two years is the widely used standard.",
        "Retention",
      ),
      Q(
        "q2",
        "The check must be complete:",
        [
          "Before employment starts",
          "Within 7 days of starting",
          "Any time in the first month",
        ],
        0,
        "Before employment starts - this is what preserves the statutory defence.",
        "Timing",
      ),
      Q(
        "q3",
        "If a right to work is time-limited you must:",
        ["Do nothing", "Re-check before it expires", "Dismiss the employee"],
        1,
        "Re-check before expiry, and take advice if evidence is not forthcoming.",
        "Re-check",
      ),
      Q(
        "q4",
        "Selective checking based on appearance or nationality is:",
        ["Efficient", "Potentially unlawful discrimination", "Recommended"],
        1,
        "Selective checking is potentially unlawful discrimination.",
        "Non-discrimination",
      ),
      Q(
        "q5",
        "A candidate says their documents will arrive next week. Best action?",
        [
          "Delay start until the check is complete",
          "Start them anyway",
          "Ask them to sign a declaration",
        ],
        0,
        "Delay start until the check is complete.",
        "Timing",
        true,
      ),
      Q(
        "q6",
        "Which record should be kept on file?",
        [
          "Clear dated copy or share code result",
          "Personal opinion",
          "Nothing - the check is enough",
        ],
        0,
        "A clear, dated copy or online check result is the evidence.",
        "Recording",
      ),
      Q(
        "q7",
        "Immigration status decisions never require specialist advice.",
        ["True", "False"],
        1,
        "Complex cases should be referred to a qualified immigration adviser.",
        "Escalation",
      ),
    ],
    resource: {
      title: "Right-to-work check crib sheet",
      sections: [
        {
          heading: "Before start date",
          items: [
            "Confirm route: manual, online service, or IDSP",
            "Complete the check and record method, date and result",
            "Store evidence in HR record",
          ],
        },
        {
          heading: "During employment",
          items: [
            "Diary re-check for any time-limited permission",
            "Apply the same process to every candidate",
            "Refer complex cases for specialist advice",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // E. Director Duties and Good Governance
  // ==========================================================================
  {
    id: "crs_director_duties",
    title: "Director Duties and Good Governance",
    category: "Governance",
    short_description:
      "Statutory duties, decision-making and record-keeping for UK directors.",
    objectives: [
      "Understand the seven statutory duties",
      "Record decisions properly",
      "Know when to escalate",
    ],
    audience: "Directors and company secretaries.",
    difficulty: "intermediate",
    duration_minutes: 30,
    source_module: "governance",
    tags: ["governance", "director", "board", "minutes"],
    lessons: [
      lesson({
        id: "l1",
        title: "The seven statutory duties",
        objective:
          "Recall the seven statutory duties and what they mean day-to-day.",
        learn:
          "**The seven duties (Companies Act 2006)**\n1. Act within powers\n2. Promote the success of the company\n3. Exercise independent judgement\n4. Exercise reasonable care, skill and diligence\n5. Avoid conflicts of interest\n6. Not accept benefits from third parties\n7. Declare interests in proposed transactions\n\nThey apply to every director - executive or non-executive - from day one.",
        example: {
          business:
            "Fictional example - Sarah, sole director of Merton Design Ltd.",
          body: "Sarah keeps a short 'decisions log' capturing why each material decision was made. When a large discount is offered by a supplier she has a personal connection with, she declares the interest before signing.",
          why: "Simple habits protect the director as well as the company.",
        },
        scenario: {
          prompt:
            "A director's spouse owns a supplier bidding for a contract. What should the director do?",
          options: [
            opt(
              "a",
              "Declare the interest and step out of the decision.",
              "best",
              "This is the correct duty - declare and don't vote.",
            ),
            opt(
              "b",
              "Vote for the supplier because they are best-placed.",
              "wrong",
              "Even if true, the director must declare and not vote.",
            ),
            opt(
              "c",
              "Say nothing to avoid embarrassment.",
              "wrong",
              "Non-declaration breaches the statutory duty.",
            ),
          ],
        },
        action: {
          title: "Open Governance",
          description:
            "Confirm your register of directors' interests is up to date.",
          route: "/governance",
          ask_jova:
            "Summarise the seven statutory director duties in plain English.",
        },
        checks: [
          check(
            "c1",
            "How many statutory duties are set out in the Companies Act?",
            ["Three", "Seven", "Ten"],
            [1],
            "Seven statutory duties under the Companies Act 2006.",
          ),
          check(
            "c2",
            "A director should declare a personal conflict of interest.",
            ["True", "False"],
            [0],
            "Yes - declaration is a statutory duty.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Seven duties apply from day one.",
            "Declare interests early - before the decision.",
            "Small documented habits protect the director.",
          ],
          common_mistake: "Assuming the duties only apply to plc directors.",
          next_preview: "Next: recording decisions well.",
        },
      }),
      lesson({
        id: "l2",
        title: "Recording decisions well",
        objective:
          "Produce decision records that stand up to scrutiny without creating bureaucracy.",
        learn:
          "**A good decision record has**\n- Date and attendees\n- Background and options considered\n- Risks and mitigations weighed\n- Decision reached and rationale\n- Signature or approval\n\nFor a small board, a page or less is often enough. Consistency matters more than length.",
        example: {
          business: "Fictional example - the two directors of Cavell & Co.",
          body: "They keep one shared document per material decision - 300 words each, signed off in the next meeting. When a customer later disputes a change of terms, the record explains exactly why.",
          why: "Well-kept records make disputes far cheaper and quicker to resolve.",
        },
        scenario: {
          prompt:
            "You approved a director loan last quarter but only recorded 'approved' in minutes. What should you do?",
          options: [
            opt(
              "a",
              "Retrospectively add the background, options and rationale.",
              "best",
              "Add a written note now, with the current date, referencing the original decision - do not backdate.",
            ),
            opt(
              "b",
              "Leave it - 'approved' is enough.",
              "risky",
              "A single word leaves the decision impossible to justify later.",
            ),
            opt(
              "c",
              "Reverse the decision.",
              "wrong",
              "Poor record-keeping isn't a reason to reverse a valid decision.",
            ),
          ],
        },
        action: {
          title: "Add missing rationale",
          description:
            "Open Governance and add rationale to any decision recorded in the last quarter with only a one-line note.",
          route: "/governance",
          ask_jova:
            "Give me a short template for a small-business decision record.",
        },
        checks: [
          check(
            "c1",
            "Recording options considered before a decision…",
            [
              "Is optional",
              "Helps demonstrate good governance",
              "Is only for listed companies",
            ],
            [1],
            "It helps demonstrate the duty to exercise reasonable care and independent judgement.",
          ),
          check(
            "c2",
            "A short, consistent decision record is better than long-but-sporadic minutes.",
            ["True", "False"],
            [0],
            "Consistency matters more than length for a small board.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Consistency beats length.",
            "Add missing context now - do not backdate.",
            "Records protect the director as much as the company.",
          ],
          common_mistake:
            "One-line minutes that offer no basis for the decision.",
          next_preview: "Next: when to seek professional support.",
        },
      }),
      lesson({
        id: "l3",
        title: "Financial difficulty and escalation",
        objective: "Recognise triggers that require professional advice.",
        learn:
          "**Common triggers**\n- Cashflow concerns or missed statutory payments\n- Disputes between directors\n- Complex or repeated conflicts of interest\n- Investigations or regulator contact\n\nWhen solvency is in doubt, director duties shift to prioritise creditor interests. Take early advice from a solicitor or licensed insolvency practitioner - waiting typically narrows options.",
        example: {
          business:
            "Fictional example - Harbour Fit Ltd sees a large customer delay payment.",
          body: "The directors take early advice, agree a payment plan with HMRC, and document the reasoning in minutes. The company recovers.",
          why: "Early advice widened the options available.",
        },
        scenario: {
          prompt:
            "You suspect the company may not be able to pay its debts in the next 90 days. What should the directors do?",
          options: [
            opt(
              "a",
              "Trade on and hope things improve.",
              "wrong",
              "This can expose directors to personal liability if solvency continues to deteriorate.",
            ),
            opt(
              "b",
              "Take early advice from a solicitor or licensed insolvency practitioner and document decisions carefully.",
              "best",
              "Early advice widens the options and evidences the duty to consider creditor interests.",
            ),
            opt(
              "c",
              "Take a large director dividend before things get worse.",
              "wrong",
              "This can expose the director to clawback and personal liability.",
            ),
          ],
        },
        action: {
          title: "Open Governance",
          description:
            "Set a standing agenda item for solvency review at each board meeting.",
          route: "/governance",
          ask_jova:
            "What are the signs that directors should take insolvency advice?",
        },
        checks: [
          check(
            "c1",
            "When solvency is in doubt, director duties:",
            [
              "Do not change",
              "Shift to prioritise creditor interests",
              "Only apply to executive directors",
            ],
            [1],
            "Director duties shift to prioritise creditor interests when solvency is in doubt.",
          ),
          check(
            "c2",
            "Waiting to take advice usually widens your options.",
            ["True", "False"],
            [1],
            "Waiting usually narrows options.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Solvency doubt shifts the duty focus.",
            "Early advice widens options.",
            "Document carefully during any period of stress.",
          ],
          common_mistake: "Delaying advice until the crisis is already public.",
          professional_support:
            "Insolvency, disputes and complex conflicts - take advice from a solicitor or licensed insolvency practitioner.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "How many statutory duties are set out in the Companies Act 2006?",
        ["Three", "Seven", "Ten"],
        1,
        "Seven.",
        "Duties",
      ),
      Q(
        "q2",
        "Recording options considered before a decision…",
        [
          "Is optional",
          "Helps demonstrate good governance",
          "Is only for listed companies",
        ],
        1,
        "Helps demonstrate good governance.",
        "Records",
      ),
      Q(
        "q3",
        "A director should declare a personal conflict of interest.",
        ["True", "False"],
        0,
        "Yes - a statutory duty.",
        "Conflicts",
      ),
      Q(
        "q4",
        "When solvency is in doubt, director duties:",
        [
          "Do not change",
          "Shift to prioritise creditor interests",
          "Only apply to executive directors",
        ],
        1,
        "Duties shift to prioritise creditors.",
        "Insolvency",
      ),
      Q(
        "q5",
        "A supplier owned by a director's spouse bids for work. Best action?",
        [
          "Declare and step out of the decision",
          "Vote in favour",
          "Say nothing",
        ],
        0,
        "Declare and step out.",
        "Conflicts",
        true,
      ),
      Q(
        "q6",
        "A one-word decision minute is:",
        ["Sufficient", "Difficult to defend if challenged", "Preferred"],
        1,
        "Difficult to defend later.",
        "Records",
      ),
      Q(
        "q7",
        "Early insolvency advice usually:",
        ["Widens options", "Narrows options", "Has no effect"],
        0,
        "Waiting narrows options.",
        "Escalation",
      ),
    ],
    resource: {
      title: "Director decision-record template",
      intro:
        "A one-page template for a small board. Not a substitute for legal advice.",
      sections: [
        { heading: "Meta", items: ["Date", "Attendees", "Interests declared"] },
        {
          heading: "Decision",
          items: [
            "Background",
            "Options considered",
            "Risks and mitigations",
            "Decision and rationale",
            "Owner and next review",
          ],
        },
        {
          heading: "Approval",
          items: ["Signed by chair", "Circulated to directors"],
        },
      ],
    },
  },

  // ==========================================================================
  // F. Practical Risk Management
  // ==========================================================================
  {
    id: "crs_risk_mgmt",
    title: "Practical Risk Management",
    category: "Risk",
    short_description:
      "Identify, score and mitigate risks in a small business.",
    objectives: [
      "Build a simple risk register",
      "Score inherent vs residual risk",
      "Choose the right response",
    ],
    audience: "Owners and operations leads.",
    difficulty: "beginner",
    duration_minutes: 28,
    source_module: "risk",
    tags: ["risk", "mitigation", "register"],
    lessons: [
      lesson({
        id: "l1",
        title: "What is a risk?",
        objective:
          "Capture risks as cause, event and consequence - not just concerns.",
        learn:
          "**Cause, event, consequence**\nA risk describes an uncertain future event and its impact:\n- Cause - what makes it more likely\n- Event - what could actually happen\n- Consequence - the effect on the business\n\n**Not a risk**\n'Cyber security' is a topic, not a risk. 'Loss of client data because MFA is not enabled on shared mailboxes' is a risk.",
        example: {
          business:
            "Fictional example - Whitfield Manufacturing depends on one supplier for 60% of raw material.",
          body: "The risk is captured as: cause - single supplier concentration; event - supplier disruption; consequence - production halt for up to four weeks.",
          why: "Framing the risk properly points at the mitigation (a second supplier).",
        },
        scenario: {
          prompt: "Which of these is the strongest risk statement?",
          options: [
            opt(
              "a",
              "'Cyber security.'",
              "wrong",
              "Too vague - it names the topic, not the risk.",
            ),
            opt(
              "b",
              "'Loss of customer data due to leaked shared credentials, leading to breach reporting and customer notification.'",
              "best",
              "Names cause, event and consequence.",
            ),
            opt(
              "c",
              "'Hackers.'",
              "wrong",
              "Names the threat actor only - no event or consequence.",
            ),
          ],
        },
        action: {
          title: "Open Risk register",
          description:
            "Review your top 5 risks and rewrite any that are missing cause or consequence.",
          route: "/risk",
          ask_jova:
            "Help me rewrite my top risks with cause, event and consequence.",
        },
        checks: [
          check(
            "c1",
            "A good risk statement should include:",
            [
              "Only the topic",
              "Cause, event and consequence",
              "The threat actor's name",
            ],
            [1],
            "Cause, event and consequence gives a workable risk statement.",
          ),
          check(
            "c2",
            "'Cyber' is a valid risk on its own.",
            ["True", "False"],
            [1],
            "No - it is a topic, not a risk.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Cause, event, consequence - always.",
            "Topics are not risks.",
            "Well-framed risks point at their own mitigations.",
          ],
          common_mistake:
            "One-word risk entries that everyone interprets differently.",
          next_preview:
            "Next: scoring risks and distinguishing inherent from residual.",
        },
      }),
      lesson({
        id: "l2",
        title: "Scoring risks",
        objective:
          "Score likelihood and impact and distinguish inherent from residual risk.",
        learn:
          "**Scoring**\nLikelihood 1–5, impact 1–5, multiply for a score out of 25.\n\n**Inherent vs residual**\n- Inherent - the risk before any controls\n- Residual - the risk after the controls you have today\n\nRecording both makes the value of your controls visible.",
        example: {
          business:
            "Fictional example - Elm Consulting scores the risk of a single-person dependency.",
          body: "Inherent 4×5 = 20. After cross-training and documentation, residual 2×4 = 8. The register shows the improvement.",
          why: "Being able to show risk reduction is a common ask from insurers and buyers.",
        },
        scenario: {
          prompt:
            "A risk has residual score 20/25. What is the strongest response?",
          options: [
            opt(
              "a",
              "Accept and move on.",
              "wrong",
              "A 20/25 residual score is not a candidate for simple acceptance.",
            ),
            opt(
              "b",
              "Add or strengthen a control, then rescore.",
              "best",
              "High residual scores need action, not acceptance.",
            ),
            opt(
              "c",
              "Remove the risk from the register.",
              "wrong",
              "Removal without action is not a strategy.",
            ),
          ],
        },
        action: {
          title: "Open Risk register",
          description: "Record inherent AND residual for your top 5 risks.",
          route: "/risk",
          ask_jova: "How should I score inherent vs residual risk?",
        },
        checks: [
          check(
            "c1",
            "Residual risk is:",
            [
              "Risk before any controls",
              "Risk after controls",
              "The same as inherent",
            ],
            [1],
            "Residual is after the controls you have today.",
          ),
          check(
            "c2",
            "A risk with likelihood 4 and impact 5 has a score of:",
            ["9", "20", "25"],
            [1],
            "4 × 5 = 20.",
          ),
        ],
        recap: {
          takeaways: [
            "Score both inherent and residual.",
            "Movement between the two shows control value.",
            "Very high residual scores need action.",
          ],
          common_mistake:
            "Scoring only inherent, so no one can see whether controls actually work.",
          next_preview: "Next: response choices.",
        },
      }),
      lesson({
        id: "l3",
        title: "Response choices",
        objective:
          "Pick a defensible response - avoid, reduce, transfer, accept, or monitor.",
        learn:
          "**Response choices**\n- Avoid - stop the activity that creates the risk\n- Reduce - put a control in place\n- Transfer - insurance or contract\n- Accept - record why, with owner and review date\n- Monitor - where uncertainty is high, watch and re-review\n\n**Ownership**\nEvery risk has one named owner and a next review date. Otherwise nothing happens.",
        example: {
          business:
            "Fictional example - Fenway Studio decides how to handle a cyber risk.",
          body: "They reduce with MFA and access review, transfer some residual with cyber insurance, and set a quarterly review.",
          why: "Layered responses are usually stronger than one big control.",
        },
        scenario: {
          prompt:
            "You want to accept a residual risk. What is the strongest way to record it?",
          options: [
            opt(
              "a",
              "Note 'accept' with the owner name, the rationale, and a review date.",
              "best",
              "This makes the acceptance defensible and reviewable.",
            ),
            opt(
              "b",
              "Delete the risk.",
              "wrong",
              "Deletion is not acceptance.",
            ),
            opt(
              "c",
              "Note 'accept' and leave it.",
              "risky",
              "Without rationale and a review date, acceptance is fragile.",
            ),
          ],
        },
        action: {
          title: "Open Risk register",
          description:
            "For every accepted risk, confirm a rationale, owner and review date is present.",
          route: "/risk",
          ask_jova: "What are the pros and cons of each risk response?",
        },
        checks: [
          check(
            "c1",
            "Which is NOT a risk response?",
            ["Avoid", "Transfer", "Delete"],
            [2],
            "Delete is not a risk response - you can accept, monitor, reduce, transfer or avoid.",
          ),
          check(
            "c2",
            "Every risk should have a named owner and a review date.",
            ["True", "False"],
            [0],
            "Otherwise nothing changes.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Choose from five responses, not just 'accept'.",
            "Layered responses beat one big control.",
            "No owner = no action.",
          ],
          common_mistake:
            "Marking risks 'accepted' with no rationale or review date.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Residual risk is:",
        [
          "Risk before any controls",
          "Risk after controls",
          "The same as inherent",
        ],
        1,
        "Residual is after the controls you have.",
        "Scoring",
      ),
      Q(
        "q2",
        "A risk score of likelihood 4 × impact 5 =",
        ["9", "20", "25"],
        1,
        "20.",
        "Scoring",
      ),
      Q(
        "q3",
        "Which is NOT a risk response?",
        ["Avoid", "Transfer", "Delete"],
        2,
        "Delete is not a response.",
        "Response",
      ),
      Q(
        "q4",
        "Best risk statement:",
        [
          "'Cyber'",
          "'Loss of client data due to leaked credentials, causing breach reporting'",
          "'Hackers'",
        ],
        1,
        "Cause, event and consequence together.",
        "Framing",
        true,
      ),
      Q(
        "q5",
        "You want to accept a residual risk. Best record?",
        ["'Accept' with owner and rationale", "'Accept'", "Delete the entry"],
        0,
        "Owner + rationale + review date.",
        "Response",
        true,
      ),
      Q(
        "q6",
        "Every risk should have:",
        ["An owner and review date", "Only an owner", "Nothing formal"],
        0,
        "Owner AND review date.",
        "Ownership",
      ),
      Q(
        "q7",
        "High residual score risks should:",
        ["Be accepted", "Be strengthened with a further control", "Be deleted"],
        1,
        "Add a control, rescore.",
        "Response",
      ),
    ],
    resource: {
      title: "Risk identification worksheet",
      sections: [
        {
          heading: "For each risk record",
          items: [
            "Cause",
            "Event",
            "Consequence",
            "Inherent (L × I)",
            "Current controls",
            "Residual (L × I)",
            "Response chosen and rationale",
            "Owner and next review",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // G. Contract Management and Renewals
  // ==========================================================================
  {
    id: "crs_contract_mgmt",
    title: "Contract Management and Renewals",
    category: "Contracts",
    short_description: "Keep contracts current and avoid unexpected renewals.",
    objectives: [
      "Track key dates",
      "Identify high-risk terms",
      "Plan renewals early",
    ],
    audience: "Owners, procurement and operations.",
    difficulty: "beginner",
    duration_minutes: 22,
    source_module: "contracts",
    tags: ["contracts", "renewal", "supplier"],
    lessons: [
      lesson({
        id: "l1",
        title: "The contract lifecycle",
        objective:
          "Recognise the stages of the lifecycle and the information you need at each stage.",
        learn:
          "**Stages**\nNegotiation → signature → obligations → renewal / termination.\n\n**Minimum register fields**\n- Counterparty, value, start/end dates\n- Notice period and next-action date\n- Owner\n- Key obligations and risks\n\nEverything else can be added when needed.",
        example: {
          business: "Fictional example - Aster & Co Consulting.",
          body: "They keep a one-line-per-contract register with next-action dates. A weekly 5-minute review means nothing slips.",
          why: "The most common contract problem is not the terms - it's the missed date.",
        },
        scenario: {
          prompt: "You have 30 contracts but no register. Where do you start?",
          options: [
            opt(
              "a",
              "Build a full contract database first.",
              "risky",
              "You'll never finish. Start with the fields that stop things going wrong.",
            ),
            opt(
              "b",
              "Capture counterparty, value, dates, notice period and owner for every active contract.",
              "best",
              "This is the minimum viable register - takes hours, saves months.",
            ),
            opt(
              "c",
              "Wait until something goes wrong.",
              "wrong",
              "The point is to prevent that.",
            ),
          ],
        },
        action: {
          title: "Open Contracts",
          description:
            "Confirm every active contract has end date, notice period and owner.",
          route: "/contracts",
          ask_jova: "What fields belong on a small business contract register?",
        },
        checks: [
          check(
            "c1",
            "The most common contract problem is:",
            ["Poor drafting", "Missed dates", "Missing witness"],
            [1],
            "Missed dates cause most problems.",
          ),
          check(
            "c2",
            "You need every clause in the register to be useful.",
            ["True", "False"],
            [1],
            "No - start with dates, value, notice period, owner.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Start with dates, value, notice period, owner.",
            "Weekly review beats a perfect database.",
            "Missed dates are the most common issue.",
          ],
          common_mistake: "Building a huge template before capturing anything.",
          next_preview: "Next: red-flag terms.",
        },
      }),
      lesson({
        id: "l2",
        title: "Red-flag terms",
        objective: "Spot terms that create the biggest downstream problems.",
        learn:
          "**Common red flags**\n- Auto-renewal without notice\n- Uncapped liability\n- Exclusivity\n- One-sided termination\n- Hidden price uplifts (RPI+X)\n\nMark these on the register so they get proper attention at renewal.",
        example: {
          business:
            "Fictional example - Kestrel Print signs a 3-year contract with auto-renewal.",
          body: "The register flags it. Six months before expiry the owner is prompted to decide whether to renew or negotiate.",
          why: "Auto-renewal is fine - surprise auto-renewal is not.",
        },
        scenario: {
          prompt:
            "You spot uncapped liability in a supplier contract. What is the strongest response?",
          options: [
            opt(
              "a",
              "Propose a liability cap linked to fees paid.",
              "best",
              "Fee-linked cap is a common and often acceptable middle ground.",
            ),
            opt(
              "b",
              "Sign as is because you trust the supplier.",
              "risky",
              "Trust does not fix a legal exposure.",
            ),
            opt(
              "c",
              "Refuse to sign anything.",
              "acceptable",
              "Sometimes right, but a proportionate negotiation is usually available.",
            ),
          ],
        },
        action: {
          title: "Open Contracts",
          description: "Flag every active contract with any red-flag term.",
          route: "/contracts",
          ask_jova: "What contract terms should I flag as high-risk?",
        },
        checks: [
          check(
            "c1",
            "A common contract red flag is:",
            [
              "Auto-renewal without notice",
              "A signature page",
              "A defined-term section",
            ],
            [0],
            "Auto-renewal without notice is the classic red flag.",
          ),
          check(
            "c2",
            "Uncapped liability is generally:",
            ["Preferred", "A red flag", "Legally required"],
            [1],
            "A red flag - negotiate a cap.",
            "single",
          ),
        ],
        recap: {
          takeaways: [
            "Auto-renewal, uncapped liability and hidden uplifts are the big three.",
            "Flag them on the register.",
            "Negotiation is usually available.",
          ],
          common_mistake: "Signing without reading the renewal terms.",
          professional_support:
            "For high-value or novel contracts, get a legal review before signing.",
          next_preview: "Next: planning renewals early.",
        },
      }),
      lesson({
        id: "l3",
        title: "Renewal planning",
        objective:
          "Trigger renewal work early enough to leave real options open.",
        learn:
          "**Timing**\nSet a reminder around 90 days before expiry - earlier for complex contracts.\n\n**Renewal steps**\n1. Confirm the notice window and any price-increase clauses.\n2. Review performance since last renewal.\n3. Benchmark against alternatives.\n4. Decide renew, renegotiate or exit - and act inside the notice window.",
        example: {
          business:
            "Fictional example - Fairhurst Interiors renegotiates its cloud tools.",
          body: "90-day reminder fires; performance and cost benchmarks are prepared; negotiation reduces cost by 12% before the auto-renewal window closes.",
          why: "The earlier the conversation starts, the more leverage you have.",
        },
        scenario: {
          prompt:
            "You realise a supplier contract auto-renewed last week because you missed the notice window. What now?",
          options: [
            opt(
              "a",
              "Contact the supplier to negotiate mid-term changes.",
              "best",
              "Even after auto-renewal, suppliers are often willing to make mid-term adjustments.",
            ),
            opt(
              "b",
              "Ignore it - you're locked in.",
              "risky",
              "Mid-term negotiation is often possible.",
            ),
            opt(
              "c",
              "Stop paying.",
              "wrong",
              "This creates a legal and reputational risk.",
            ),
          ],
        },
        action: {
          title: "Open Contracts",
          description:
            "Set a 90-day-before-expiry reminder on every renewable contract.",
          route: "/contracts",
          ask_jova: "Give me a contract renewal checklist.",
        },
        checks: [
          check(
            "c1",
            "You should plan renewals:",
            [
              "The day of expiry",
              "About 90 days before expiry",
              "After expiry",
            ],
            [1],
            "90 days gives room to benchmark and negotiate.",
          ),
          check(
            "c2",
            "Even after auto-renewal, mid-term negotiation is often possible.",
            ["True", "False"],
            [0],
            "Suppliers often prefer to keep the relationship healthy.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "90 days is the practical minimum.",
            "Benchmarks give you negotiation leverage.",
            "Miss the window? Try mid-term negotiation.",
          ],
          common_mistake: "Setting the reminder too late to negotiate.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "A common contract red flag is:",
        [
          "Auto-renewal without notice",
          "A signature page",
          "A defined-term section",
        ],
        0,
        "Auto-renewal without notice is the classic red flag.",
        "Red flags",
      ),
      Q(
        "q2",
        "You should plan renewals:",
        ["The day of expiry", "About 90 days before expiry", "After expiry"],
        1,
        "90 days minimum.",
        "Renewal",
      ),
      Q(
        "q3",
        "Uncapped liability is generally:",
        ["Preferred", "A red flag", "Legally required"],
        1,
        "A red flag.",
        "Red flags",
      ),
      Q(
        "q4",
        "You have 30 contracts and no register. Best first step?",
        [
          "Build a full database",
          "Capture dates, value, notice period, owner for each",
          "Wait for a problem",
        ],
        1,
        "Minimum viable register first.",
        "Register",
        true,
      ),
      Q(
        "q5",
        "Auto-renewal happened by surprise. Best response?",
        [
          "Contact the supplier for mid-term negotiation",
          "Stop paying",
          "Do nothing",
        ],
        0,
        "Mid-term negotiation is often available.",
        "Renewal",
        true,
      ),
      Q(
        "q6",
        "The most common contract problem is:",
        ["Poor drafting", "Missed dates", "Missing witness"],
        1,
        "Missed dates.",
        "Lifecycle",
      ),
      Q(
        "q7",
        "High-value or novel contracts should get:",
        ["A legal review before signing", "A quick skim", "No review"],
        0,
        "Legal review before signing.",
        "Escalation",
      ),
    ],
    resource: {
      title: "Contract renewal checklist",
      sections: [
        {
          heading: "90 days out",
          items: [
            "Confirm notice window",
            "Note any price-increase clause",
            "Kick off benchmarking",
          ],
        },
        {
          heading: "60 days out",
          items: [
            "Review performance",
            "Draft renew/renegotiate/exit decision",
          ],
        },
        {
          heading: "30 days out",
          items: ["Serve any notice required", "Confirm decision in writing"],
        },
      ],
    },
  },

  // ==========================================================================
  // H. Contractor Status and IR35 Awareness
  // ==========================================================================
  {
    id: "crs_ir35",
    title: "Contractor Status and IR35 Awareness",
    category: "HR",
    short_description:
      "Understand IR35 status factors and record your assessment properly.",
    objectives: [
      "Know the main status factors",
      "Complete a status determination",
      "Understand who is liable",
    ],
    audience: "Anyone engaging contractors or PSCs.",
    difficulty: "intermediate",
    duration_minutes: 26,
    source_module: "hr",
    tags: ["hr", "ir35", "contractor", "off-payroll"],
    lessons: [
      lesson({
        id: "l1",
        title: "Labels vs working reality",
        objective:
          "See past the label 'contractor' to the actual working relationship.",
        learn:
          "**Why it matters**\nOff-payroll working rules look at how the engagement really works, not what it is called. Getting status wrong can create unpaid tax and NIC liabilities.\n\n**What HMRC looks at**\nWho decides what work is done, when and how; whether a genuine right of substitution exists; and how integrated the person is with your team.",
        example: {
          business:
            "Fictional example - Ferndale Tech uses a 'contractor' as team lead for two years.",
          body: "The person has a company laptop, sits in the daily stand-up, has direct reports, and cannot send a substitute. On the working reality, the engagement looks like employment.",
          why: "Labels don't protect either party if the reality is different.",
        },
        scenario: {
          prompt:
            "A 'contractor' has worked full-time for you for 18 months with no substitute rights. What should you do?",
          options: [
            opt(
              "a",
              "Complete a written status assessment considering control, substitution and mutuality.",
              "best",
              "Formal assessment is the right response - the outcome may point to inside IR35.",
            ),
            opt(
              "b",
              "Keep the arrangement because it saves cost.",
              "wrong",
              "Cost saving is not a defence.",
            ),
            opt(
              "c",
              "End the engagement immediately.",
              "risky",
              "You may still need advice on the exit.",
            ),
          ],
        },
        action: {
          title: "Open HR",
          description:
            "Confirm every current contractor has a Status Determination Statement (SDS) on file.",
          route: "/hr",
          ask_jova:
            "What factors distinguish an employee from a genuine contractor?",
        },
        checks: [
          check(
            "c1",
            "Which is a core IR35 test?",
            ["Control", "Marketing spend", "Website traffic"],
            [0],
            "Control is one of the core tests.",
          ),
          check(
            "c2",
            "The label 'contractor' by itself determines status.",
            ["True", "False"],
            [1],
            "The label does not determine status - the working reality does.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Working reality trumps labels.",
            "Long, integrated engagements need particular care.",
            "Assessment is the answer, not avoidance.",
          ],
          common_mistake: "Assuming 'contractor' in the title is enough.",
          next_preview: "Next: the main tests in detail.",
        },
      }),
      lesson({
        id: "l2",
        title: "The main tests",
        objective: "Apply the main IR35 tests to a real engagement.",
        learn:
          "**Personal service and substitution**\nDoes the person have to do the work themselves, or can they send a substitute (with a genuine right, not a paper one)?\n\n**Control**\nWho decides what, how, when and where the work is done?\n\n**Mutuality of obligation**\nIs there an ongoing obligation to offer and accept work?\n\n**Other factors**\nFinancial risk, own equipment, own insurance, being 'part and parcel' of the team.",
        example: {
          business: "Fictional example - Two contractors at Chorley Data.",
          body: "A) A specialist paid per deliverable, using own laptop and insurance, working from own office - looks outside IR35. B) A long-term daily-rate developer embedded in the delivery team - looks more like employment.",
          why: "Two 'contractors' can be on very different sides of the line.",
        },
        scenario: {
          prompt:
            "A substitution clause is in the contract but the client insists only the named person can attend. What is the position?",
          options: [
            opt(
              "a",
              "The clause protects you.",
              "wrong",
              "A right that cannot be used in practice is often ignored by HMRC.",
            ),
            opt(
              "b",
              "The right must be genuine in practice, not just on paper.",
              "best",
              "This is the practical test HMRC applies.",
            ),
            opt("c", "It depends on the fee.", "wrong", "Fee is not the test."),
          ],
        },
        action: {
          title: "Open HR",
          description:
            "Review any contractor whose substitution right has never been used.",
          route: "/hr",
          ask_jova: "Explain mutuality of obligation for IR35.",
        },
        checks: [
          check(
            "c1",
            "A 'right of substitution' only counts if:",
            [
              "It appears in the contract",
              "It is real in practice",
              "The contractor is a limited company",
            ],
            [1],
            "It has to be real in practice.",
          ),
          check(
            "c2",
            "Select the core IR35 tests.",
            ["Control", "Substitution", "Marketing spend", "Mutuality"],
            [0, 1, 3],
            "Control, substitution and mutuality are the core tests.",
            "multi",
          ),
        ],
        recap: {
          takeaways: [
            "Personal service, control, mutuality - the core three.",
            "Paper rights that never work in practice are weak.",
            "Two 'contractors' can be on different sides of the line.",
          ],
          common_mistake:
            "Copy-paste substitution clauses that no one ever uses.",
          next_preview: "Next: recording the decision.",
        },
      }),
      lesson({
        id: "l3",
        title: "Status determinations",
        objective: "Record a defensible Status Determination Statement (SDS).",
        learn:
          "**What goes in an SDS**\n- Description of the engagement\n- Factors considered (control, substitution, mutuality, etc.)\n- Reasoning for the conclusion\n- Reviewer, date, version\n\n**Reviews**\nRe-assess at contract renewal and whenever working practices change materially. Keep prior versions.",
        example: {
          business: "Fictional example - Meadowbank Legal issues an SDS.",
          body: "The SDS records why the engagement is outside IR35 - genuine substitution used twice, own equipment, project-based fee, low integration with team.",
          why: "The written reasoning is what makes the position defensible if challenged.",
        },
        scenario: {
          prompt:
            "You have no written SDS for a long-standing contractor. What should you do?",
          options: [
            opt(
              "a",
              "Write one now based on the current working reality.",
              "best",
              "Better to have it late than not at all - reflect actual practice.",
            ),
            opt(
              "b",
              "Assume outside IR35.",
              "wrong",
              "Assumption is not a defence.",
            ),
            opt(
              "c",
              "Refuse to renew.",
              "risky",
              "You may still owe fair process - take advice.",
            ),
          ],
        },
        action: {
          title: "Open HR",
          description: "Add an SDS for every current contractor lacking one.",
          route: "/hr",
          ask_jova: "What should be in a Status Determination Statement?",
        },
        checks: [
          check(
            "c1",
            "An SDS is:",
            [
              "A safety data sheet",
              "A Status Determination Statement",
              "A share dealing scheme",
            ],
            [1],
            "A Status Determination Statement.",
          ),
          check(
            "c2",
            "IR35 should be re-checked when:",
            [
              "Never",
              "Working practices change materially",
              "Only at year end",
            ],
            [1],
            "Re-check on material change or renewal.",
          ),
        ],
        recap: {
          takeaways: [
            "Every contractor should have a written SDS.",
            "Reflect actual practice, not the ideal.",
            "Re-check on renewal or material change.",
          ],
          common_mistake: "Assuming an SDS from 2019 still applies today.",
          professional_support:
            "Complex or high-value engagements: take tax and employment advice.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Which is a core IR35 test?",
        ["Control", "Marketing spend", "Website traffic"],
        0,
        "Control is one of the core tests.",
        "Tests",
      ),
      Q(
        "q2",
        "An SDS is:",
        [
          "A safety data sheet",
          "A Status Determination Statement",
          "A share dealing scheme",
        ],
        1,
        "Status Determination Statement.",
        "Assessment",
      ),
      Q(
        "q3",
        "IR35 should be re-checked when:",
        ["Never", "Working practices change materially", "Only at year end"],
        1,
        "On material change or renewal.",
        "Review",
      ),
      Q(
        "q4",
        "A substitution clause only counts if:",
        [
          "It appears in the contract",
          "It is real in practice",
          "The contractor is a Ltd co",
        ],
        1,
        "Real in practice.",
        "Substitution",
        true,
      ),
      Q(
        "q5",
        "A 'contractor' has worked full-time for 18 months, no substitute rights. Best action?",
        [
          "Complete a written status assessment",
          "Do nothing",
          "End immediately with no advice",
        ],
        0,
        "Assess and, if needed, take advice.",
        "Assessment",
        true,
      ),
      Q(
        "q6",
        "Mutuality of obligation is about:",
        [
          "Ongoing offer and acceptance of work",
          "Pension entitlement",
          "Company logo",
        ],
        0,
        "Ongoing offer and acceptance.",
        "Tests",
      ),
      Q(
        "q7",
        "The label 'contractor' by itself determines status.",
        ["True", "False"],
        1,
        "Working reality determines status.",
        "Labels",
      ),
    ],
    resource: {
      title: "Status Determination Statement outline",
      sections: [
        {
          heading: "Engagement",
          items: ["Parties and role", "Duration and fee basis"],
        },
        {
          heading: "Assessment",
          items: [
            "Control",
            "Substitution (paper and practice)",
            "Mutuality of obligation",
            "Financial risk",
            "Equipment",
            "Integration",
          ],
        },
        {
          heading: "Conclusion",
          items: ["Reasoning", "Reviewer and date", "Next review trigger"],
        },
      ],
    },
  },

  // ==========================================================================
  // I. Health and Safety for Small Businesses
  // ==========================================================================
  {
    id: "crs_hs",
    title: "Health and Safety for Small Businesses",
    category: "Health & Safety",
    short_description:
      "The baseline H&S duties every small employer must meet.",
    objectives: [
      "Complete a suitable risk assessment",
      "Publish an H&S policy if 5+ employees",
      "Report RIDDOR incidents",
    ],
    audience: "Owners and office managers.",
    difficulty: "beginner",
    duration_minutes: 24,
    source_module: "governance",
    tags: ["health and safety", "hs", "riddor", "hse"],
    lessons: [
      lesson({
        id: "l1",
        title: "Legal baseline",
        objective:
          "Recall the general duty of care and the practical minimum for a small employer.",
        learn:
          "**General duty**\nEvery employer must, so far as reasonably practicable, protect the health, safety and welfare of employees and anyone else affected by the business (visitors, contractors, the public).\n\n**Practical minimum**\n- Suitable and sufficient risk assessments\n- Written H&S policy where 5+ employees\n- Consultation with employees\n- Records of incidents",
        example: {
          business: "Fictional example - Brookside Café.",
          body: "Six staff, a written policy on a single page, a kitchen risk assessment, an incident log with two entries, and a monthly team check-in on H&S.",
          why: "Proportionate to the business - but complete.",
        },
        scenario: {
          prompt:
            "You have six employees and no written H&S policy. What is the strongest immediate step?",
          options: [
            opt(
              "a",
              "Publish a short, one-page policy signed by the owner.",
              "best",
              "A short policy is required from 5+ employees - start simple.",
            ),
            opt(
              "b",
              "Wait until an inspection.",
              "wrong",
              "You have a duty now.",
            ),
            opt(
              "c",
              "Buy an off-the-shelf 60-page manual and put it in a drawer.",
              "risky",
              "A policy no one reads doesn't help.",
            ),
          ],
        },
        action: {
          title: "Open Governance",
          description:
            "Add or link the H&S policy in the Governance policy list.",
          route: "/governance",
          ask_jova:
            "What is the minimum H&S policy content for a small employer?",
        },
        checks: [
          check(
            "c1",
            "A written H&S policy is required when you have:",
            ["1+ employee", "5+ employees", "50+ employees"],
            [1],
            "5+ employees triggers the written policy requirement.",
          ),
          check(
            "c2",
            "H&S duties apply only to employees, not to visitors.",
            ["True", "False"],
            [1],
            "Duties extend to anyone affected by the business.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Proportionate is fine - but complete.",
            "5+ employees means a written policy.",
            "Duties extend beyond employees.",
          ],
          common_mistake: "Buying a policy no one reads.",
          next_preview: "Next: doing a proper risk assessment.",
        },
      }),
      lesson({
        id: "l2",
        title: "Risk assessment",
        objective: "Complete a suitable and sufficient risk assessment.",
        learn:
          "**Five steps**\n1. Identify hazards.\n2. Decide who might be harmed and how.\n3. Evaluate risks and decide precautions.\n4. Record findings.\n5. Review and update.\n\nInclude home workers, contractors and any young or expectant workers.",
        example: {
          business:
            "Fictional example - Ashland Studio has three home workers.",
          body: "The risk assessment includes home worker DSE (display screen equipment). Two employees identify chair issues - the studio funds ergonomic upgrades.",
          why: "Home working is workplace working - include it.",
        },
        scenario: {
          prompt:
            "A new home worker has no proper chair. What is the strongest response?",
          options: [
            opt(
              "a",
              "Assess and provide reasonable support.",
              "best",
              "Even for home workers, the employer has duties.",
            ),
            opt(
              "b",
              "Say it's their home, not your problem.",
              "wrong",
              "Home working duties still apply.",
            ),
            opt(
              "c",
              "Insist they come into the office.",
              "risky",
              "Not necessarily the right or reasonable answer.",
            ),
          ],
        },
        action: {
          title: "Open Governance",
          description:
            "Add a home-working section to the current risk assessment.",
          route: "/governance",
          ask_jova: "Give me a home-working risk assessment checklist.",
        },
        checks: [
          check(
            "c1",
            "Risk assessments should be:",
            ["One-off", "Reviewed regularly", "Only for factories"],
            [1],
            "Reviewed regularly and after change.",
          ),
          check(
            "c2",
            "Home workers are included in H&S duties.",
            ["True", "False"],
            [0],
            "Yes.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Five simple steps.",
            "Include home workers.",
            "Record findings - otherwise nothing is enforceable.",
          ],
          common_mistake:
            "Assessing only the office, not the wider working reality.",
          next_preview: "Next: incidents and reporting.",
        },
      }),
      lesson({
        id: "l3",
        title: "Incidents and reporting",
        objective:
          "Recognise reportable incidents and keep the required records.",
        learn:
          "**RIDDOR**\nCertain injuries, occupational diseases and dangerous occurrences must be reported to the HSE.\n\n**Incident log**\nEvery incident (reportable or not) should be logged - date, people involved, what happened, what changed as a result.\n\n**When to escalate**\nSerious injury, near-miss with high potential harm, prosecution risk, or any HSE contact - take professional advice.",
        example: {
          business: "Fictional example - Blackthorn Manufacturing.",
          body: "A crush injury is reported under RIDDOR, an investigation captures the root cause, and the guarding on the machine is upgraded before restart.",
          why: "The report is only step one - the change is the point.",
        },
        scenario: {
          prompt:
            "A near-miss almost led to a serious injury. What should you do?",
          options: [
            opt(
              "a",
              "Log it, investigate, and change what allowed it to happen.",
              "best",
              "Near-misses are the cheapest lesson you'll ever get.",
            ),
            opt(
              "b",
              "Ignore it - no one was hurt.",
              "wrong",
              "Near-misses often precede injuries.",
            ),
            opt(
              "c",
              "Report it publicly.",
              "risky",
              "Public disclosure is not the appropriate first step.",
            ),
          ],
        },
        action: {
          title: "Open Compliance",
          description:
            "Confirm any H&S obligation with 'reporting' in scope is up to date.",
          route: "/compliance",
          ask_jova: "How do we tell if an incident is RIDDOR reportable?",
        },
        checks: [
          check(
            "c1",
            "Serious workplace injuries must be reported under:",
            ["RIDDOR", "GDPR", "IR35"],
            [0],
            "RIDDOR.",
          ),
          check(
            "c2",
            "Near-misses should be logged even if no one was hurt.",
            ["True", "False"],
            [0],
            "Yes - they are early warnings.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "RIDDOR is specific - check whether an incident qualifies.",
            "Log near-misses too.",
            "The change afterwards is the point.",
          ],
          common_mistake: "Only logging incidents when there was an injury.",
          professional_support:
            "Prosecution risk, HSE contact or serious injury - take specialist advice.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "A written H&S policy is required when you have:",
        ["1+ employee", "5+ employees", "50+ employees"],
        1,
        "5+ employees.",
        "Policy",
      ),
      Q(
        "q2",
        "Serious workplace injuries must be reported under:",
        ["RIDDOR", "GDPR", "IR35"],
        0,
        "RIDDOR.",
        "Reporting",
      ),
      Q(
        "q3",
        "Risk assessments should be:",
        ["One-off", "Reviewed regularly", "Only for factories"],
        1,
        "Reviewed regularly.",
        "Assessment",
      ),
      Q(
        "q4",
        "A new home worker has no proper chair. Best response?",
        [
          "Assess and provide reasonable support",
          "Not your problem - it's their home",
          "Insist they come to the office",
        ],
        0,
        "H&S duties extend to home workers.",
        "Home working",
        true,
      ),
      Q(
        "q5",
        "Near-misses should be:",
        ["Ignored", "Logged and investigated", "Only reported if injury"],
        1,
        "Logged and investigated.",
        "Incidents",
      ),
      Q(
        "q6",
        "H&S duties extend to visitors and contractors.",
        ["True", "False"],
        0,
        "Yes.",
        "Scope",
      ),
      Q(
        "q7",
        "The general duty of care is 'so far as reasonably practicable'.",
        ["True", "False"],
        0,
        "This is the statutory phrasing.",
        "Duty",
      ),
    ],
    resource: {
      title: "Health & safety mini-manual",
      sections: [
        {
          heading: "Policy",
          items: [
            "Short written policy signed by owner",
            "Roles named",
            "Review date",
          ],
        },
        {
          heading: "Risk assessment",
          items: [
            "Hazards",
            "Who may be harmed",
            "Controls",
            "Records",
            "Review trigger",
          ],
        },
        {
          heading: "Incidents",
          items: [
            "Incident log kept",
            "RIDDOR criteria checked",
            "Near-miss investigation",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // J. Tender Evidence and Bid Readiness
  // ==========================================================================
  {
    id: "crs_tender_evidence",
    title: "Tender Evidence and Bid Readiness",
    category: "Growth",
    short_description:
      "Assemble the evidence buyers ask for and answer common bid questions.",
    objectives: [
      "Understand common bid requirements",
      "Maintain an evidence library",
      "Write clear, compliant responses",
    ],
    audience: "Bid leads and business owners.",
    difficulty: "intermediate",
    duration_minutes: 30,
    source_module: "tender-ready",
    tags: ["tender", "bid", "procurement", "evidence"],
    lessons: [
      lesson({
        id: "l1",
        title: "Understanding the requirements",
        objective:
          "Break a tender down into mandatory and scored requirements before writing anything.",
        learn:
          "**Two categories**\n- Mandatory pass/fail (e.g. insurance, accounts, certifications)\n- Scored (quality, price, social value)\n\n**Weightings**\nA 60/40 quality/price tender is a very different bid to a 90/10 quality one. Read the weightings before you decide to bid.\n\n**Word limits and format**\nBuyers routinely disqualify bids that exceed word limits or use the wrong format.",
        example: {
          business:
            "Fictional example - Kestrel Consulting bids for a council contract.",
          body: "They map every requirement to owner and word count, and mark mandatory items. A missing insurance certificate is spotted a week before submission - with time to fix.",
          why: "Requirement mapping first prevents a last-minute panic.",
        },
        scenario: {
          prompt:
            "You have 10 days until submission and no mandatory insurance evidence. What is the strongest response?",
          options: [
            opt(
              "a",
              "Contact your broker today to get evidence issued or updated.",
              "best",
              "Mandatory evidence has to be there - start now.",
            ),
            opt(
              "b",
              "Submit the bid and hope they don't check.",
              "wrong",
              "Missing mandatory evidence is a pass/fail failure.",
            ),
            opt(
              "c",
              "Withdraw immediately.",
              "risky",
              "Not necessary - there's still time to get evidence.",
            ),
          ],
        },
        action: {
          title: "Open Tender Ready",
          description:
            "Confirm every mandatory requirement on your active opportunity has evidence linked.",
          route: "/tender-ready",
          ask_jova: "How do I break a tender into requirements and owners?",
        },
        checks: [
          check(
            "c1",
            "Mandatory pass/fail criteria should be:",
            [
              "Left until last",
              "Confirmed before bidding",
              "Ignored for small bids",
            ],
            [1],
            "Confirm mandatories before deciding to bid.",
          ),
          check(
            "c2",
            "Missing mandatory evidence often causes:",
            [
              "Automatic disqualification",
              "A small score deduction",
              "No effect",
            ],
            [0],
            "It typically means disqualification.",
          ),
        ],
        recap: {
          takeaways: [
            "Two categories: mandatory and scored.",
            "Read the weightings before deciding to bid.",
            "Word limits and format matter.",
          ],
          common_mistake: "Writing responses before mapping requirements.",
          next_preview: "Next: the evidence library.",
        },
      }),
      lesson({
        id: "l2",
        title: "The evidence library",
        objective:
          "Maintain a reusable evidence library so every bid starts 60% written.",
        learn:
          "**Common items buyers ask for**\nInsurance certificates, accounts, key policies (H&S, EDI, DP, cyber), case studies, references, certifications, ISO/CE where relevant.\n\n**Library management**\n- Keep current versions with issue dates\n- Version and archive old versions\n- Named owner for each item\n- Automatic renewal reminders\n\n**Reuse well**\nRe-writing every bid from scratch is the biggest source of low-quality responses.",
        example: {
          business:
            "Fictional example - Aspen Build stores insurance, RAMS, and 6 case studies in a shared folder.",
          body: "Each item has an issue date and owner. Renewal reminders fire 30 days before expiry.",
          why: "The library turns a two-week bid into a two-day bid.",
        },
        scenario: {
          prompt:
            "Cyber essentials evidence has expired. What is the strongest response?",
          options: [
            opt(
              "a",
              "Renew and update the library - it will be asked for repeatedly.",
              "best",
              "Certifications commonly appear as mandatory.",
            ),
            opt(
              "b",
              "Ignore - you can address it next bid.",
              "risky",
              "Certifications typically block bids until renewed.",
            ),
            opt(
              "c",
              "Fabricate a temporary certificate.",
              "wrong",
              "Never fabricate evidence.",
            ),
          ],
        },
        action: {
          title: "Open Tender Ready",
          description:
            "Confirm every item in your Evidence Library has an issue date and owner.",
          route: "/tender-ready",
          ask_jova: "What should be in a small business bid evidence library?",
        },
        checks: [
          check(
            "c1",
            "The evidence library should be:",
            ["Kept current and versioned", "Recreated per bid", "Optional"],
            [0],
            "Kept current and versioned.",
          ),
          check(
            "c2",
            "Fabricating a certificate to meet a deadline is acceptable.",
            ["True", "False"],
            [1],
            "Never - this is fraud.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Reuse cuts bid time dramatically.",
            "Version and date every item.",
            "Never fabricate evidence.",
          ],
          common_mistake: "Copying old case studies without updating them.",
          next_preview: "Next: writing responses that win.",
        },
      }),
      lesson({
        id: "l3",
        title: "Writing to win",
        objective: "Answer the question the buyer actually asked.",
        learn:
          "**Structure**\nRestate the requirement · Claim · Evidence · Benefit to the buyer.\n\n**Language**\nUse the buyer's vocabulary. Avoid marketing filler.\n\n**Review**\nOne person writes, another reviews. Fresh eyes catch structural problems faster than the writer will.",
        example: {
          business:
            "Fictional example - Two firms bid for a facilities contract.",
          body: "Firm A restates each requirement, gives a specific claim with evidence, and links to buyer benefit. Firm B uses generic marketing text. Firm A scores materially higher on quality.",
          why: "Buyers score against the question, not against how impressive the prose sounds.",
        },
        scenario: {
          prompt:
            "You have 500 words on 'social value'. What is the strongest structure?",
          options: [
            opt(
              "a",
              "Restate the requirement, describe specific commitments, evidence past delivery, and link to the buyer's outcome.",
              "best",
              "Restate → claim → evidence → benefit.",
            ),
            opt(
              "b",
              "Marketing paragraphs about your values.",
              "wrong",
              "Generic prose scores poorly.",
            ),
            opt(
              "c",
              "A bullet list of buzzwords.",
              "wrong",
              "Buzzwords fail on evidencing.",
            ),
          ],
        },
        action: {
          title: "Open Tender Ready",
          description:
            "Confirm every response has an owner and a reviewer named.",
          route: "/tender-ready",
          ask_jova: "Give me a template for a strong tender response.",
        },
        checks: [
          check(
            "c1",
            "A strong bid response should:",
            [
              "Restate the question, claim and evidence",
              "Use generic marketing text",
              "Skip word limits",
            ],
            [0],
            "Restate → claim → evidence → benefit.",
          ),
          check(
            "c2",
            "One-person authorship without a second reviewer is best practice.",
            ["True", "False"],
            [1],
            "Second reviewer catches issues the writer will miss.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Answer the question asked.",
            "Structure: restate, claim, evidence, benefit.",
            "Always have a second reviewer.",
          ],
          common_mistake:
            "Reusing case studies without linking them to the specific requirement.",
          professional_support:
            "For complex frameworks or novel contract terms, take advice before submitting.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Mandatory pass/fail criteria should be:",
        [
          "Left until last",
          "Confirmed before bidding",
          "Ignored for small bids",
        ],
        1,
        "Confirm before deciding to bid.",
        "Requirements",
      ),
      Q(
        "q2",
        "A strong bid response should:",
        [
          "Restate, claim, evidence",
          "Use generic marketing text",
          "Skip word limits",
        ],
        0,
        "Restate → claim → evidence → benefit.",
        "Writing",
      ),
      Q(
        "q3",
        "The evidence library should be:",
        ["Kept current and versioned", "Recreated per bid", "Optional"],
        0,
        "Kept current.",
        "Library",
      ),
      Q(
        "q4",
        "Cyber Essentials expires 3 days before submission. Best response?",
        ["Renew immediately", "Ignore", "Fabricate a certificate"],
        0,
        "Renew - never fabricate.",
        "Evidence",
        true,
      ),
      Q(
        "q5",
        "Missing mandatory evidence typically causes:",
        ["Automatic disqualification", "A small score deduction", "No effect"],
        0,
        "Disqualification.",
        "Requirements",
      ),
      Q(
        "q6",
        "Every response should have:",
        ["An owner and a second reviewer", "One author only", "No named owner"],
        0,
        "Owner + reviewer.",
        "Process",
      ),
      Q(
        "q7",
        "Buyers score against:",
        [
          "The specific question asked",
          "How impressive the prose sounds",
          "How long the response is",
        ],
        0,
        "The specific question.",
        "Writing",
      ),
    ],
    resource: {
      title: "Tender evidence checklist",
      sections: [
        {
          heading: "Insurance",
          items: [
            "Employer's liability",
            "Public liability",
            "Professional indemnity (where relevant)",
          ],
        },
        {
          heading: "Financial",
          items: ["Latest filed accounts", "Bank reference if requested"],
        },
        {
          heading: "Policies",
          items: [
            "H&S",
            "EDI",
            "Data protection",
            "Cyber security",
            "Modern slavery (where relevant)",
          ],
        },
        {
          heading: "Delivery",
          items: [
            "Case studies (current, versioned)",
            "Client references (permission checked)",
            "Certifications with issue dates",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // K. Investor Due-Diligence Fundamentals
  // ==========================================================================
  {
    id: "crs_investor_dd",
    title: "Investor Due-Diligence Fundamentals",
    category: "Growth",
    short_description: "What investors typically ask for and how to be ready.",
    objectives: [
      "Anticipate investor requests",
      "Organise your data room",
      "Avoid common red flags",
    ],
    audience: "Founders and finance leads.",
    difficulty: "intermediate",
    duration_minutes: 30,
    source_module: "investor-ready",
    tags: ["investor", "due diligence", "data room", "fundraising"],
    lessons: [
      lesson({
        id: "l1",
        title: "Purpose and the four workstreams",
        objective: "Understand what investors actually want to see and why.",
        learn:
          "**Why DD exists**\nInvestors want to price risk, not remove it. Clear, honest evidence lets them price it low.\n\n**Four workstreams**\n- Corporate - ownership, cap table, minutes\n- Financial - accounts, forecasts, tax\n- Legal / commercial - key contracts, IP, disputes\n- People - key staff, contracts, incentives",
        example: {
          business: "Fictional example - a founder pitches for £500k.",
          body: "Because the DD checklist is largely already in place, the process takes six weeks instead of six months, and the investor closes.",
          why: "Speed is a form of trust - a well-prepared data room accelerates decisions.",
        },
        scenario: {
          prompt:
            "An investor asks for your cap table on day one. You don't have one written down. What should you do?",
          options: [
            opt(
              "a",
              "Produce a clean cap table from the shareholders' register and Companies House filings today.",
              "best",
              "This is standard and expected - do it now.",
            ),
            opt(
              "b",
              "Say you'll come back to them.",
              "risky",
              "The delay signals disorganisation.",
            ),
            opt(
              "c",
              "Send a rough estimate.",
              "wrong",
              "Estimates on ownership are a red flag.",
            ),
          ],
        },
        action: {
          title: "Open Investor Ready",
          description: "Confirm every DD item has an owner and status.",
          route: "/investor-ready",
          ask_jova: "What are the four DD workstreams for a small business?",
        },
        checks: [
          check(
            "c1",
            "Investor DD typically covers:",
            [
              "Corporate, financial, legal/commercial, people",
              "Only financials",
              "Only marketing",
            ],
            [0],
            "Four workstreams.",
          ),
          check(
            "c2",
            "A rough estimate is fine for a cap table.",
            ["True", "False"],
            [1],
            "Ownership must be precise.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "DD prices risk - it does not remove it.",
            "Four workstreams cover most requests.",
            "Preparation speeds up decisions.",
          ],
          common_mistake:
            "Getting caught out by ownership questions on day one.",
          next_preview: "Next: organising a data room.",
        },
      }),
      lesson({
        id: "l2",
        title: "Organising a data room",
        objective: "Set up a data room that mirrors what investors expect.",
        learn:
          "**Structure**\nOne folder per workstream, mirroring the DD checklist. Named files, versions, dates.\n\n**Access**\nUse a data-room tool with per-user access and read logs.\n\n**Housekeeping**\nMove out-of-date documents to an archive folder. Do not delete - investors ask why documents disappeared.",
        example: {
          business:
            "Fictional example - Northgate Tech shares a data room during a Series A.",
          body: "Folders match the DD checklist. Read logs show which investors reviewed what, so follow-ups are efficient.",
          why: "Signals discipline before a single question is asked.",
        },
        scenario: {
          prompt:
            "You want to remove an old shareholders' agreement replaced 12 months ago. What is the strongest approach?",
          options: [
            opt(
              "a",
              "Move it to an archive folder with a note explaining supersession.",
              "best",
              "Transparent and defensible.",
            ),
            opt(
              "b",
              "Delete it entirely.",
              "risky",
              "Missing documents raise questions.",
            ),
            opt(
              "c",
              "Leave both in the main folder unlabelled.",
              "wrong",
              "Confusing and looks disorganised.",
            ),
          ],
        },
        action: {
          title: "Open Investor Ready",
          description:
            "Confirm the DD checklist maps to your data room folder structure.",
          route: "/investor-ready",
          ask_jova: "What's a sensible data-room folder structure?",
        },
        checks: [
          check(
            "c1",
            "Data rooms should:",
            [
              "Mirror the DD checklist",
              "Be shared publicly",
              "Be created after the term sheet",
            ],
            [0],
            "Mirror the checklist.",
          ),
          check(
            "c2",
            "Deleting old documents once superseded is best practice.",
            ["True", "False"],
            [1],
            "Archive rather than delete.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Mirror the checklist.",
            "Version, date, and archive - never delete.",
            "Read logs help follow-up.",
          ],
          common_mistake:
            "Delivering documents drip-by-drip instead of a structured pack.",
          next_preview: "Next: red flags to avoid.",
        },
      }),
      lesson({
        id: "l3",
        title: "Avoiding red flags",
        objective: "Recognise the issues that most often derail deals.",
        learn:
          "**Common red flags**\n- Unclear ownership or unsigned cap table\n- Missing or informal board minutes\n- Undocumented related-party transactions\n- Unresolved IP ownership (especially with contractors)\n- Verbal customer contracts on material revenue\n\n**Honesty accelerates**\nDisclose known gaps early with a plan to close them - investors reward candour.",
        example: {
          business:
            "Fictional example - a founder discloses a related-party lease upfront.",
          body: "Rather than derail the deal at DD, the disclosure enables it to be addressed in the shareholder agreement.",
          why: "Early disclosure is a strength, not a weakness.",
        },
        scenario: {
          prompt: "A material contract was never signed. What should you do?",
          options: [
            opt(
              "a",
              "Disclose it and set a plan to formalise before completion.",
              "best",
              "Disclosure with a plan is credible.",
            ),
            opt(
              "b",
              "Hide it and hope the investor doesn't ask.",
              "wrong",
              "Hiding almost always destroys trust.",
            ),
            opt("c", "Backdate a signature.", "wrong", "Backdating is fraud."),
          ],
        },
        action: {
          title: "Open Investor Ready",
          description:
            "Identify any 'missing' DD item and assign a fix owner and date.",
          route: "/investor-ready",
          ask_jova: "What are the biggest DD red flags for a small company?",
        },
        checks: [
          check(
            "c1",
            "A common DD red flag is:",
            [
              "Signed board minutes",
              "Undocumented related-party transactions",
              "Filed accounts",
            ],
            [1],
            "Undocumented related-party transactions.",
          ),
          check(
            "c2",
            "Disclosing known issues early usually accelerates the deal.",
            ["True", "False"],
            [0],
            "Early disclosure typically speeds decisions.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Ownership, minutes, IP, contracts, related parties - check first.",
            "Disclose early with a plan.",
            "Never backdate.",
          ],
          common_mistake: "Waiting for DD to surface known problems.",
          professional_support:
            "For structuring, shareholder agreements or tax planning - take advice from a solicitor and accountant.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "Investor DD typically covers:",
        [
          "Corporate, financial, legal/commercial, people",
          "Only financials",
          "Only marketing",
        ],
        0,
        "Four workstreams.",
        "Scope",
      ),
      Q(
        "q2",
        "A common DD red flag is:",
        [
          "Signed board minutes",
          "Undocumented related-party transactions",
          "Filed accounts",
        ],
        1,
        "Undocumented related-party transactions.",
        "Red flags",
      ),
      Q(
        "q3",
        "Data rooms should:",
        [
          "Mirror the DD checklist",
          "Be shared publicly",
          "Be created after the term sheet",
        ],
        0,
        "Mirror the checklist.",
        "Data room",
      ),
      Q(
        "q4",
        "You don't have a written cap table. Best response?",
        [
          "Produce one from filings today",
          "Give a rough estimate",
          "Refuse to share",
        ],
        0,
        "Produce a clean cap table today.",
        "Corporate",
        true,
      ),
      Q(
        "q5",
        "Disclosing known issues early usually:",
        ["Accelerates the deal", "Kills the deal", "Has no effect"],
        0,
        "Accelerates.",
        "Approach",
      ),
      Q(
        "q6",
        "Backdating a missing signature is:",
        ["Acceptable", "Fraud", "Encouraged"],
        1,
        "Fraud.",
        "Ethics",
      ),
      Q(
        "q7",
        "Superseded documents should be:",
        ["Deleted", "Archived and labelled", "Left mixed in"],
        1,
        "Archived, not deleted.",
        "Data room",
      ),
    ],
    resource: {
      title: "Investor DD preparation checklist",
      sections: [
        {
          heading: "Corporate",
          items: [
            "Cap table",
            "Companies House filings current",
            "Board minutes for material decisions",
          ],
        },
        {
          heading: "Financial",
          items: [
            "Filed accounts",
            "Management accounts",
            "Forecast",
            "Tax history",
          ],
        },
        {
          heading: "Legal / commercial",
          items: [
            "Top-5 customer contracts",
            "Top-5 supplier contracts",
            "IP register",
            "Any disputes / claims",
          ],
        },
        {
          heading: "People",
          items: [
            "Key staff contracts",
            "Contractor SDS",
            "Incentives / options",
          ],
        },
      ],
    },
  },

  // ==========================================================================
  // L. Data Breach Response Basics
  // ==========================================================================
  {
    id: "crs_breach_response",
    title: "Data Breach Response Basics",
    category: "Data Protection",
    short_description:
      "First response when a personal data breach is suspected.",
    objectives: [
      "Recognise a breach",
      "Contain and assess",
      "Decide on notification",
    ],
    audience: "Owners, IT and DP leads.",
    difficulty: "beginner",
    duration_minutes: 22,
    source_module: "gdpr",
    tags: ["gdpr", "breach", "ico", "incident"],
    lessons: [
      lesson({
        id: "l1",
        title: "Recognising a breach",
        objective: "Recognise the many forms a personal data breach can take.",
        learn:
          "**Definition**\nAccidental or unlawful loss, disclosure, access, alteration or destruction of personal data.\n\n**Everyday examples**\n- Misdirected email\n- Lost device\n- Shared folder set to public\n- Compromised credentials\n- Rogue employee download\n\nNot every incident is reportable - but every one is logged.",
        example: {
          business:
            "Fictional example - Northlake Care emails a spreadsheet with staff bank details to a supplier by mistake.",
          body: "The incident is a personal data breach - even if the supplier deletes the file on request.",
          why: "The definition is broad. When in doubt, assume it's a breach and log it.",
        },
        scenario: {
          prompt:
            "A shared folder was inadvertently set to public for two hours. Is this a breach?",
          options: [
            opt(
              "a",
              "Yes - access rights changed, personal data was exposed.",
              "best",
              "Exposure counts even if you cannot see who accessed.",
            ),
            opt(
              "b",
              "No - nothing was downloaded that you know of.",
              "wrong",
              "Not knowing doesn't remove the exposure.",
            ),
            opt(
              "c",
              "Only if someone complains.",
              "wrong",
              "Complaints are not the trigger.",
            ),
          ],
        },
        action: {
          title: "Open GDPR › Breaches",
          description:
            "Confirm every incident this year has a decision recorded (report / not report / lessons).",
          route: "/gdpr",
          ask_jova: "What counts as a personal data breach in plain English?",
        },
        checks: [
          check(
            "c1",
            "Which counts as a personal data breach?",
            [
              "Misdirected email with personal data",
              "Sending a customer a marketing brochure",
              "Publishing your own privacy notice",
            ],
            [0],
            "Misdirected personal data is a classic breach.",
          ),
          check(
            "c2",
            "Every incident should be logged, even if not reportable.",
            ["True", "False"],
            [0],
            "Logging is required for accountability.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Definition is broad - err on the side of logging.",
            "Reportability is decided after logging.",
            "Even 'small' incidents build the picture.",
          ],
          common_mistake: "Only logging incidents that made someone complain.",
          next_preview: "Next: first 72 hours.",
        },
      }),
      lesson({
        id: "l2",
        title: "First 72 hours",
        objective: "Run a proportionate response inside the reporting window.",
        learn:
          "**Sequence**\n1. Contain - stop the exposure.\n2. Assess - categories of data, number of people, likely risk to individuals.\n3. Decide - is the risk to individuals likely enough to notify the ICO within 72 hours?\n4. Notify individuals - where high risk to them.\n5. Record - everything you did, when, and why.\n\nPartial notification is better than no notification.",
        example: {
          business:
            "Fictional example - Kilnfield Group loses a laptop with unencrypted client data.",
          body: "Within 24 hours they revoke access, assess exposure, notify the ICO (72-hour window) and set up a customer support line. Records are kept throughout.",
          why: "The clock starts when awareness begins, not when the investigation ends.",
        },
        scenario: {
          prompt:
            "You have partial facts at 48 hours. What is the strongest approach?",
          options: [
            opt(
              "a",
              "File a partial ICO notification and update as facts emerge.",
              "best",
              "Partial notification is expected and encouraged.",
            ),
            opt(
              "b",
              "Wait until you have all the facts.",
              "risky",
              "Waiting past 72 hours may itself be a breach.",
            ),
            opt(
              "c",
              "Do not notify at all.",
              "wrong",
              "This can compound the issue.",
            ),
          ],
        },
        action: {
          title: "Open GDPR › Breaches",
          description:
            "Confirm every open incident has a decision date, not just a log date.",
          route: "/gdpr",
          ask_jova: "Walk me through a first 72-hour breach response.",
        },
        checks: [
          check(
            "c1",
            "The ICO notification window for a reportable breach is:",
            ["24 hours", "72 hours", "30 days"],
            [1],
            "72 hours from awareness.",
          ),
          check(
            "c2",
            "Individuals should be told when:",
            ["Always", "There is a high risk to them", "Never"],
            [1],
            "When there is a high risk to individuals.",
          ),
        ],
        recap: {
          takeaways: [
            "Contain, assess, decide, notify, record.",
            "Partial notification beats missing the window.",
            "The clock starts on awareness.",
          ],
          common_mistake:
            "Missing the window while waiting for perfect information.",
          professional_support:
            "Ransomware, large-scale or special-category breaches - take specialist advice.",
          next_preview: "Next: learning and evidence.",
        },
      }),
      lesson({
        id: "l3",
        title: "Learning and evidence",
        objective: "Capture what you learn so the next incident is smaller.",
        learn:
          "**Incident record**\nDate, description, data affected, people affected, containment steps, decisions, notifications, lessons.\n\n**Change what you can**\nAfter every incident (reportable or not), change at least one thing - a control, a process, a template - so a repeat is less likely.",
        example: {
          business:
            "Fictional example - Beacon Care has a misdirected email breach.",
          body: "Following the incident they introduce a pause-and-verify workflow for bulk emails to external addresses. Repeat incidents fall to zero over the next year.",
          why: "The record is only valuable if it drives a change.",
        },
        scenario: {
          prompt:
            "An investigation is complete but no changes have been made. What is the strongest response?",
          options: [
            opt(
              "a",
              "Identify one specific change and assign an owner and date.",
              "best",
              "Concrete change assigned to an owner is what reduces future risk.",
            ),
            opt(
              "b",
              "Note 'improve training' and leave it.",
              "risky",
              "Too vague to prevent recurrence.",
            ),
            opt(
              "c",
              "Close the incident without change.",
              "wrong",
              "You've lost the value of the lesson.",
            ),
          ],
        },
        action: {
          title: "Open GDPR",
          description:
            "Add a 'lessons learned' entry with a named owner to any recent incident missing one.",
          route: "/gdpr",
          ask_jova: "What should a good incident lessons-learned note contain?",
        },
        checks: [
          check(
            "c1",
            "You should log every breach:",
            ["Only reportable ones", "All breaches", "Only annual summary"],
            [1],
            "All breaches, reportable or not.",
          ),
          check(
            "c2",
            "A vague 'improve training' change is enough to close the loop.",
            ["True", "False"],
            [1],
            "Assign an owner and a specific action.",
            "truefalse",
          ),
        ],
        recap: {
          takeaways: [
            "Log everything.",
            "Change one thing after every incident.",
            "Named owner and date - always.",
          ],
          common_mistake: "Closing incidents without a concrete change.",
          professional_support:
            "For any suspected ICO investigation or civil claim - take advice.",
          next_preview: "Take the final knowledge check when you're ready.",
        },
      }),
    ],
    quiz: [
      Q(
        "q1",
        "The ICO notification window for a reportable breach is:",
        ["24 hours", "72 hours", "30 days"],
        1,
        "72 hours from awareness.",
        "Notification",
      ),
      Q(
        "q2",
        "You should log every breach:",
        ["Only reportable ones", "All breaches", "Only annual summary"],
        1,
        "All breaches - reportable or not.",
        "Recording",
      ),
      Q(
        "q3",
        "Individuals should be told when:",
        ["Always", "There is high risk to them", "Never"],
        1,
        "When there is a high risk to individuals.",
        "Notification",
      ),
      Q(
        "q4",
        "A shared folder was public for two hours. Is this a breach?",
        [
          "Yes - access rights changed and personal data was exposed",
          "No - nothing was downloaded",
          "Only if someone complains",
        ],
        0,
        "Exposure counts.",
        "Recognition",
        true,
      ),
      Q(
        "q5",
        "You have partial facts at 48 hours. Best action?",
        [
          "File a partial ICO notification and update later",
          "Wait for full facts",
          "Do not notify",
        ],
        0,
        "Partial notification is encouraged.",
        "Notification",
        true,
      ),
      Q(
        "q6",
        "The best 'lessons learned' entry:",
        [
          "Concrete change with an owner and date",
          "'Improve training'",
          "None",
        ],
        0,
        "Concrete, owned, dated.",
        "Learning",
      ),
      Q(
        "q7",
        "Ransomware and special-category breaches usually need:",
        ["Specialist support", "Silent resolution", "Only internal handling"],
        0,
        "Specialist support.",
        "Escalation",
      ),
    ],
    resource: {
      title: "Breach response prompt sheet",
      sections: [
        {
          heading: "First hour",
          items: [
            "Contain the exposure",
            "Preserve evidence",
            "Convene the response team",
          ],
        },
        {
          heading: "Within 72 hours",
          items: [
            "Assess data, people, risk",
            "Decide on ICO notification",
            "Decide on individual notification if high risk",
          ],
        },
        {
          heading: "After close",
          items: [
            "Record incident and decisions",
            "Assign one concrete change",
            "Update policies and templates",
          ],
        },
      ],
    },
  },
];

export function getCourse(id: string): Course | null {
  return COURSES.find((c) => c.id === id) ?? null;
}
export const COURSE_CATEGORIES = Array.from(
  new Set(COURSES.map((c) => c.category)),
).sort();

// -----------------------------------------------------------------------------
// Content-safety validation (development-only console warnings; no UI impact).
// -----------------------------------------------------------------------------

const HIGH_RISK_PHRASES = [
  "always",
  "never",
  "guarantees",
  "guaranteed",
  "proves compliance",
  "legally approved",
  "automatically compliant",
  "definitely required",
  "no risk",
  "must report every breach",
];

export function validateAcademyContent(): { warnings: string[] } {
  const warnings: string[] = [];
  for (const c of COURSES) {
    for (const q of c.quiz) {
      const text =
        `${q.question} ${q.options.join(" ")} ${q.explanation ?? ""}`.toLowerCase();
      const hits = HIGH_RISK_PHRASES.filter((p) => text.includes(p));
      const sensitive =
        q.riskLevel === "sensitive" || q.riskLevel === "professional_judgement";
      if (sensitive && (!q.explanation || !q.professionalSupportTrigger)) {
        warnings.push(
          `[${c.id}/${q.id}] sensitive question missing feedback or professional-support trigger`,
        );
      }
      if (hits.length && q.riskLevel !== "professional_judgement") {
        warnings.push(
          `[${c.id}/${q.id}] contains high-risk absolute wording (${hits.join(", ")}) - review`,
        );
      }
    }
  }
  return { warnings };
}

if (
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
) {
  const { warnings } = validateAcademyContent();
  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn("[Academy content safety]", warnings);
  }
}
