import { z } from "zod";

// Shared validation for investor readiness: profile, data room, and the scored
// readiness self-assessment.

const isoDate = z.string().date();

// --- Investor profile (single current record) -------------------------------
export const saveInvestorProfileSchema = z.object({
  fundingStage: z.string().trim().max(40).default("pre_seed"),
  amountSought: z.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default("GBP"),
  fundingPurpose: z.string().nullish(),
  targetCloseDate: isoDate.nullish(),
  currentRevenueBand: z.string().trim().max(80).nullish(),
  growthSummary: z.string().nullish(),
  tractionSummary: z.string().nullish(),
  marketSummary: z.string().nullish(),
  teamSummary: z.string().nullish(),
  investmentType: z.string().trim().max(40).default("undecided"),
  status: z.string().trim().max(40).default("preparing"),
});
export type SaveInvestorProfileInput = z.infer<
  typeof saveInvestorProfileSchema
>;

// --- Data room items --------------------------------------------------------
export const dataRoomStatusEnum = z.enum([
  "missing",
  "requested",
  "in_progress",
  "ready",
]);
export const createDataRoomItemSchema = z.object({
  folder: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  documentType: z.string().trim().max(80).nullish(),
  version: z.string().trim().max(20).default("1.0"),
  status: dataRoomStatusEnum.default("missing"),
  confidentiality: z.string().trim().max(40).default("standard"),
  reviewDate: isoDate.nullish(),
  notes: z.string().nullish(),
});
export const updateDataRoomItemSchema = createDataRoomItemSchema.partial();
export type CreateDataRoomItemInput = z.infer<typeof createDataRoomItemSchema>;
export type UpdateDataRoomItemInput = z.infer<typeof updateDataRoomItemSchema>;

// --- Readiness assessment (checklist by diligence dimension) -----------------
export const INVESTOR_DIMENSIONS = [
  "corporate",
  "financial",
  "legal",
  "compliance",
  "commercial",
  "people",
  "data_room",
] as const;
export type InvestorDimension = (typeof INVESTOR_DIMENSIONS)[number];

// Guided "Run assessment" wizard: questions grouped by diligence dimension,
// each answered yes / partial / no / unsure / na. Scored deterministically.
export const answerOptionEnum = z.enum([
  "yes",
  "partial",
  "no",
  "unsure",
  "na",
]);
export type AnswerOption = z.infer<typeof answerOptionEnum>;

export interface AssessmentQuestion {
  id: string;
  text: string;
  redFlag?: boolean; // a "no" here is a red flag for investors
}
export interface AssessmentStep {
  dim: InvestorDimension;
  label: string;
  questions: AssessmentQuestion[];
}

export const INVESTOR_ASSESSMENT: AssessmentStep[] = [
  {
    dim: "corporate",
    label: "Corporate structure",
    questions: [
      {
        id: "q_incorp",
        text: "Are your certificate of incorporation and articles filed and accessible?",
      },
      { id: "q_psc", text: "Is your PSC and members' register up to date?" },
      {
        id: "q_captable",
        text: "Do you have a current cap table with option pool?",
        redFlag: true,
      },
    ],
  },
  {
    dim: "financial",
    label: "Financial records",
    questions: [
      {
        id: "q_accounts",
        text: "Are your last statutory accounts filed?",
        redFlag: true,
      },
      { id: "q_mgmt", text: "Do you produce monthly management accounts?" },
      {
        id: "q_forecast",
        text: "Do you have a 3-year financial forecast with sensitivities?",
      },
      { id: "q_tax", text: "Is your tax position (VAT, PAYE, CT) up to date?" },
    ],
  },
  {
    dim: "legal",
    label: "Legal and contracts",
    questions: [
      {
        id: "q_contracts",
        text: "Are your material contracts organised and reviewed?",
      },
      {
        id: "q_ip",
        text: "Are IP assignments in place for staff and contractors?",
        redFlag: true,
      },
      {
        id: "q_disputes",
        text: "Are you free of material disputes and litigation?",
        redFlag: true,
      },
    ],
  },
  {
    dim: "compliance",
    label: "Compliance and data",
    questions: [
      {
        id: "q_gdpr",
        text: "Is your GDPR position organised (ROPA, notices, DPIAs)?",
      },
      { id: "q_reg", text: "Are your regulatory obligations up to date?" },
      { id: "q_insurance", text: "Do you hold appropriate insurance?" },
    ],
  },
  {
    dim: "commercial",
    label: "Commercial and market",
    questions: [
      { id: "q_plan", text: "Do you have a current business plan?" },
      {
        id: "q_traction",
        text: "Can you evidence customer traction and retention?",
      },
      { id: "q_market", text: "Do you have a documented market analysis?" },
    ],
  },
  {
    dim: "people",
    label: "People",
    questions: [
      { id: "q_emp", text: "Are all employee contracts signed and current?" },
      {
        id: "q_contractor",
        text: "Are contractor arrangements documented (IR35/SDS where required)?",
      },
    ],
  },
  {
    dim: "data_room",
    label: "Data room",
    questions: [
      {
        id: "q_dr_index",
        text: "Is your data-room folder structure in place?",
      },
      { id: "q_dr_pitch", text: "Do you have an investor pitch deck?" },
    ],
  },
];

export const ALL_ASSESSMENT_QUESTIONS = INVESTOR_ASSESSMENT.flatMap(
  (s) => s.questions,
);

export const saveReadinessAssessmentSchema = z.object({
  answers: z.record(z.string(), answerOptionEnum),
});
export type SaveReadinessAssessmentInput = z.infer<
  typeof saveReadinessAssessmentSchema
>;
