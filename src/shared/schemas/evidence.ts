import { z } from "zod";

// Evidence confirmation - the proof recorded when a user completes an obligation
// (e.g. after filing at Companies House) or attaches evidence to any record.

export const confirmEvidenceSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).default("compliance"),
  notes: z.string().trim().max(2000).nullish(),
  fileName: z.string().trim().max(300).nullish(),
  reviewDate: z.string().date().nullish(),
  // When true (default), completing evidence also marks the obligation complete.
  completeObligation: z.boolean().default(true),
});

export type ConfirmEvidenceInput = z.infer<typeof confirmEvidenceSchema>;
