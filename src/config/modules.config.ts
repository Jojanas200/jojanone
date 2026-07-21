import {
  LayoutDashboard,
  Briefcase,
  History,
  FileBarChart,
  Sparkles,
  SlidersHorizontal,
  Map,
  FileText,
  Users,
  ShieldCheck,
  Lock,
  Landmark,
  ScrollText,
  AlertTriangle,
  TrendingUp,
  Award,
  GraduationCap,
  Settings,
  Upload,
  Building2,
  FileCheck,
  CreditCard,
  type LucideIcon,
} from "lucide-react";

export type ModuleStatus = "Live" | "In Development" | "Coming Soon";

export interface ModuleConfig {
  key: string;
  title: string;
  route: string;
  section: string;
  icon: LucideIcon;
  description: string;
  tagline: string;
  features: string[];
  status: ModuleStatus;
}

export const SECTIONS = [
  "Core Intelligence",
  "Business",
  "Compliance & Governance",
  "Growth",
  "Learning",
  "System",
] as const;

export const MODULES: ModuleConfig[] = [
  {
    key: "dashboard",
    title: "Dashboard",
    route: "/dashboard",
    section: "Core Intelligence",
    icon: LayoutDashboard,
    tagline: "Your business, at a glance.",
    description:
      "A central view combining Jova's findings, your Business Confidence Score, and today's priorities.",
    features: [
      "Business Confidence Score",
      "Daily Jova briefing",
      "Priority actions",
      "Quick navigation to every module",
    ],
    status: "In Development",
  },
  {
    key: "executive",
    title: "Executive",
    route: "/executive",
    section: "Core Intelligence",
    icon: Briefcase,
    tagline: "A leadership-level view of business health.",
    description:
      "Roll-up reporting across every module, built for founders and executives.",
    features: [
      "Cross-module risk summary",
      "Board-ready snapshots",
      "Trend overview",
      "Executive briefings",
    ],
    status: "Coming Soon",
  },
  {
    key: "timeline",
    title: "Timeline",
    route: "/timeline",
    section: "Core Intelligence",
    icon: History,
    tagline: "Every event that shaped your business, in one place.",
    description:
      "A chronological record of obligations, decisions and changes.",
    features: [
      "Full activity history",
      "Filterable timeline",
      "Audit-ready record",
      "Milestone tracking",
    ],
    status: "Coming Soon",
  },
  {
    key: "reports",
    title: "Reports",
    route: "/reports",
    section: "Core Intelligence",
    icon: FileBarChart,
    tagline: "Turn your data into evidence.",
    description:
      "Exportable reports built for lenders, insurers and investors.",
    features: [
      "Compliance reports",
      "Custom report builder",
      "Scheduled exports",
      "Shareable summaries",
    ],
    status: "Coming Soon",
  },
  {
    key: "jova",
    title: "Jova",
    route: "/jova",
    section: "Core Intelligence",
    icon: Sparkles,
    tagline: "Your always-on business protection intelligence.",
    description:
      "The heart of the platform - detecting, explaining and resolving risk.",
    features: [
      "Daily risk detection",
      "Plain-language explanations",
      "Guided resolution",
      "Human expert escalation",
    ],
    status: "In Development",
  },
  {
    key: "simulator",
    title: "Simulator",
    route: "/simulator",
    section: "Business",
    icon: SlidersHorizontal,
    tagline: "Test decisions before you make them.",
    description:
      "Model the compliance and risk impact of hiring, growth or structural changes.",
    features: [
      "Scenario modeling",
      "Risk impact preview",
      "Growth planning tools",
    ],
    status: "Live",
  },
  {
    key: "business-map",
    title: "Business Map",
    route: "/business-map",
    section: "Business",
    icon: Map,
    tagline: "See your business structure clearly.",
    description: "A visual map of entities, ownership and key relationships.",
    features: [
      "Entity structure view",
      "Ownership mapping",
      "Relationship tracking",
    ],
    status: "Live",
  },
  {
    key: "contracts",
    title: "Contracts",
    route: "/contracts",
    section: "Business",
    icon: FileText,
    tagline: "Contracts, understood at a glance.",
    description: "Upload and review your business's contracts.",
    features: [
      "Contract upload",
      "Risk flagging",
      "Key term extraction",
      "Renewal tracking",
    ],
    status: "Live",
  },
  {
    key: "hr",
    title: "HR",
    route: "/hr",
    section: "Business",
    icon: Users,
    tagline: "People risk, made visible.",
    description: "Employment-related compliance and obligations in one place.",
    features: [
      "Employment obligation tracking",
      "Policy management",
      "HR compliance calendar",
    ],
    status: "Live",
  },
  {
    key: "compliance",
    title: "Compliance",
    route: "/compliance",
    section: "Compliance & Governance",
    icon: ShieldCheck,
    tagline: "Every obligation, tracked automatically.",
    description:
      "Statutory and regulatory obligation monitoring for your business.",
    features: [
      "Obligation tracking",
      "Deadline monitoring",
      "Filing guidance",
      "Source-cited explanations",
    ],
    status: "Live",
  },
  {
    key: "gdpr",
    title: "GDPR",
    route: "/gdpr",
    section: "Compliance & Governance",
    icon: Lock,
    tagline: "Data protection, handled properly.",
    description: "Your data protection obligations and records, kept current.",
    features: [
      "Data mapping",
      "Processing register",
      "Breach response guidance",
    ],
    status: "Live",
  },
  {
    key: "governance",
    title: "Governance",
    route: "/governance",
    section: "Compliance & Governance",
    icon: Landmark,
    tagline: "Board-level discipline, without the overhead.",
    description:
      "Decisions, minutes and governance records that hold up to scrutiny.",
    features: ["Decision logging", "Minute-keeping", "Governance calendar"],
    status: "Live",
  },
  {
    key: "policies",
    title: "Policies",
    route: "/policies",
    section: "Compliance & Governance",
    icon: ScrollText,
    tagline: "The policies your business runs on, kept current.",
    description:
      "A living policy register - versioned, owned, reviewed on a schedule, with staff sign-off tracked.",
    features: [
      "Versioned policy register",
      "Owners and review dates",
      "Scheduled review reminders",
      "Staff sign-off tracking",
    ],
    status: "Live",
  },
  {
    key: "evidence",
    title: "Evidence",
    route: "/evidence",
    section: "Compliance & Governance",
    icon: FileCheck,
    tagline: "The proof behind your compliance.",
    description:
      "A dated evidence library - records confirmed when you complete obligations, ready for lenders, insurers and auditors.",
    features: [
      "Evidence on completion",
      "Linked to obligations",
      "Audit-ready record",
    ],
    status: "Live",
  },
  {
    key: "risk",
    title: "Risk",
    route: "/risk",
    section: "Compliance & Governance",
    icon: AlertTriangle,
    tagline: "A complete picture of business risk.",
    description: "Risk visibility that extends beyond compliance alone.",
    features: ["Risk register", "Severity scoring", "Mitigation tracking"],
    status: "Live",
  },
  {
    key: "investor-ready",
    title: "Investor Ready",
    route: "/investor-ready",
    section: "Growth",
    icon: TrendingUp,
    tagline: "Be ready before they ask.",
    description: "Investor due-diligence readiness, maintained continuously.",
    features: [
      "Due-diligence checklist",
      "Data room preparation",
      "Readiness scoring",
    ],
    status: "Live",
  },
  {
    key: "tender-ready",
    title: "Tender Ready",
    route: "/tender-ready",
    section: "Growth",
    icon: Award,
    tagline: "Win more of the contracts you bid for.",
    description: "Tender and procurement readiness, always current.",
    features: [
      "Tender checklist",
      "Certification tracking",
      "Readiness scoring",
    ],
    status: "Live",
  },
  {
    key: "academy",
    title: "Academy",
    route: "/academy",
    section: "Learning",
    icon: GraduationCap,
    tagline:
      "Build capability, close knowledge gaps and keep a clear learning record.",
    description:
      "Assign, complete and evidence learning that reflects your business's current risks and obligations.",
    features: [
      "Guided courses tied to your business",
      "Team training with due dates",
      "Knowledge checks and certificates",
    ],
    status: "Live",
  },
  {
    key: "companies-house",
    title: "Companies House",
    route: "/companies-house",
    section: "Business",
    icon: Building2,
    tagline: "Official company data, honestly sourced.",
    description:
      "Read-only Companies House lookups (profile, officers, filing history), cached and labelled with source and retrieval time.",
    features: [
      "Company profile & officers",
      "Filing history",
      "Source-labelled + cached",
      "Deep-links to official filing",
    ],
    status: "Live",
  },
  {
    key: "import",
    title: "Bulk import",
    route: "/import",
    section: "System",
    icon: Upload,
    tagline: "Bring your existing records in from CSV.",
    description:
      "Import contracts, people and obligations from a spreadsheet, with per-row validation before anything is saved.",
    features: [
      "CSV templates",
      "Per-row validation",
      "Preview before commit",
      "Audit-logged imports",
    ],
    status: "Live",
  },
  {
    key: "billing",
    title: "Billing & plan",
    route: "/billing",
    section: "System",
    icon: CreditCard,
    tagline: "Your subscription and team seats.",
    description:
      "Manage your Starter or Growth plan and seats. Safety notices, exports and professional-support escalation are never paywalled.",
    features: [
      "Plan & seat overview",
      "Stripe Checkout & Portal",
      "Seat enforcement",
    ],
    status: "Live",
  },
  {
    key: "settings",
    title: "Settings",
    route: "/settings",
    section: "System",
    icon: Settings,
    tagline: "Your business, your data, your control.",
    description: "Manage your profile, preferences and data from one place.",
    features: [
      "Business profile",
      "Notification preferences",
      "Data controls",
      "Account management",
    ],
    status: "In Development",
  },
];

export const MODULES_BY_SECTION = SECTIONS.map((section) => ({
  section,
  items: MODULES.filter((m) => m.section === section),
}));

export const MODULE_KEYS = MODULES.map((m) => m.key);

// Keep only known module keys (deduped). Returns null (= full access) for an
// empty or all-unknown selection. Shared by invitations and member scoping.
export function filterKnownModules(
  keys: string[] | null | undefined,
): string[] | null {
  if (!keys?.length) return null;
  const known = new Set(MODULE_KEYS);
  const clean = [...new Set(keys)].filter((k) => known.has(k));
  return clean.length ? clean : null;
}

// Modules an owner can scope an adviser to. "settings" is always available to
// every member, so it is never part of a scope selection.
export const ADVISER_SCOPABLE_MODULES = MODULES.filter(
  (m) => m.key !== "settings",
);

export function getModule(key: string): ModuleConfig {
  const m = MODULES.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown module: ${key}`);
  return m;
}
