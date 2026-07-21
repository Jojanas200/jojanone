import { z } from "zod";

// Uploaded documents are filed as Evidence-library items with a binary stored
// in the private 'evidence' bucket. These bounds mirror the bucket config
// (supabase/migrations/0005_commercial_control_storage.sql).

export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024; // 50MB (bucket limit)

export const ALLOWED_DOCUMENT_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const ALLOWED_IMAGE_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const accessLevelEnum = z.enum(["workspace", "restricted"]);

const isoDate = z.string().date();

// Metadata recorded alongside an uploaded document (section 11 fields).
export const documentMetaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  owner: z.string().trim().max(200).nullish(),
  issueDate: isoDate.nullish(),
  reviewDate: isoDate.nullish(),
  accessLevel: accessLevelEnum.default("workspace"),
  description: z.string().trim().max(1000).nullish(),
  sourceModule: z.string().trim().max(40).default("onboarding"),
});

export type DocumentMetaInput = z.infer<typeof documentMetaSchema>;
