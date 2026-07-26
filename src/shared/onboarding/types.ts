// =============================================================================
// Conditional onboarding schema - type definitions.
//
// Onboarding is defined as DATA (see schema.ts), not one giant hand-built form.
// Every field carries a stable id, data type, validation, required status,
// conditional-display rule, sensitivity classification, permissions and the
// destination module the answer ultimately feeds. A single schema-driven
// renderer turns this into the wizard, so the UI cost scales with the number of
// field TYPES, not the number of fields.
// =============================================================================

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Answers are keyed by stable field id. */
export type OnboardingAnswers = Record<string, JsonValue | undefined>;

// --- Field data types --------------------------------------------------------
export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "password" // never persisted by us - handled by Supabase Auth
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "boolean" // yes / no toggle
  | "yesno_unsure" // yes / no / unsure (unsure creates a review recommendation)
  | "color"
  | "address"
  | "consent" // must be true to satisfy the field
  | "people_list" // repeatable people (directors/PSCs/owners) - progressive
  | "team_invites" // repeatable invitations - progressive
  | "file"; // optional document upload/import - progressive

// --- Required semantics -------------------------------------------------------
//   initial      - must be answered to finish first-time onboarding
//   progressive  - collected later inside the relevant module; optional now
//   optional      - never required
export type RequiredMode = "initial" | "progressive" | "optional";

// --- Sensitivity classification ----------------------------------------------
//   secret            - never stored by Jojan One (auth password, card details)
//   special_category  - GDPR special-category / criminal-offence data facts
//   confidential      - financials, ownership %, PSCs
//   standard          - ordinary business facts
//   low               - cosmetic / marketing preferences
export type Sensitivity =
  "secret" | "special_category" | "confidential" | "standard" | "low";

// --- Roles that may see/edit a field (five-role model) -----------------------
export type Role =
  "owner_admin" | "manager" | "team_member" | "adviser" | "read_only";

// --- Destination module an answer feeds --------------------------------------
export type DestinationModule =
  | "auth"
  | "profile"
  | "settings"
  | "business-map"
  | "governance"
  | "policies"
  | "hr"
  | "gdpr"
  | "contracts"
  | "risk"
  | "compliance"
  | "academy"
  | "investor-ready"
  | "tender-ready"
  | "reports"
  | "evidence"
  | "jova"
  | "team"
  | "billing";

// --- Conditional-display / conditional-required rule DSL ----------------------
export type Rule =
  | { field: string; equals: JsonValue }
  | { field: string; in: JsonValue[] }
  | { field: string; contains: JsonValue } // array-valued field includes value
  | { field: string; truthy: true }
  | { all: Rule[] }
  | { any: Rule[] }
  | { not: Rule };

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string; // regex source
  email?: boolean;
  url?: boolean;
}

export interface Option {
  value: string;
  label: string;
}

export interface FieldDef {
  /** Stable, namespaced id, e.g. "company.legal_name". Never renumber. */
  id: string;
  label: string;
  help?: string;
  placeholder?: string;
  type: FieldType;
  options?: Option[];
  validation?: FieldValidation;
  required: RequiredMode;
  /** Elevates the field to initially-required when the rule matches. */
  requiredIf?: Rule;
  /** Field is shown only when this rule matches (always shown if absent). */
  showIf?: Rule;
  sensitivity: Sensitivity;
  /** Roles allowed to view/edit. Onboarding is owner-led by default. */
  permissions: Role[];
  destinationModule: DestinationModule;
  /** True for values Jojan One must never persist (auth/payment). */
  neverStore?: boolean;
}

export interface SectionDef {
  id: string;
  title: string;
  summary: string;
  fields: FieldDef[];
}

export type OnboardingSchema = SectionDef[];
