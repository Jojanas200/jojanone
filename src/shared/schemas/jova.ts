import { z } from "zod";

// Jova chat - ask a grounded question about the workspace.
export const askSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().nullish(),
});

export type AskInput = z.infer<typeof askSchema>;
