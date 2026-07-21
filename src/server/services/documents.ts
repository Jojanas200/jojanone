import { and, desc, eq, isNotNull } from "drizzle-orm";
import { withUser, type UserClaims } from "../db";
import { evidenceLibraryItems } from "../db/schema";
import { recordActivity } from "./activity";
import type { DocumentMetaInput } from "../../shared/schemas/documents";

/**
 * Documents = Evidence-library items with a binary in the private 'evidence'
 * bucket. The DB metadata lives here (RLS-scoped); the Storage upload / signed
 * URL / object removal happen in the route with the request-scoped Supabase
 * client, so object RLS (path = workspace_id/…) is enforced too.
 */

export interface StoredBinary {
  objectKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export function recordDocument(
  claims: UserClaims,
  workspaceId: string,
  meta: DocumentMetaInput,
  binary: StoredBinary,
) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .insert(evidenceLibraryItems)
      .values({
        workspaceId,
        category: meta.category,
        title: meta.title,
        description: meta.description ?? null,
        owner: meta.owner ?? null,
        issueDate: meta.issueDate ?? null,
        reviewDate: meta.reviewDate ?? null,
        accessLevel: meta.accessLevel,
        sourceModule: meta.sourceModule,
        status: "current",
        objectKey: binary.objectKey,
        mimeType: binary.mimeType,
        sizeBytes: binary.sizeBytes,
        originalName: binary.originalName,
        fileName: binary.originalName,
        uploadedBy: claims.sub,
      })
      .returning();
    await recordActivity(tx, workspaceId, {
      module: "evidence",
      action: "created",
      title: rows[0].title,
      referenceId: rows[0].id,
    });
    return rows[0];
  });
}

export function listDocuments(claims: UserClaims, sourceModule?: string) {
  return withUser(claims, (tx) =>
    tx
      .select()
      .from(evidenceLibraryItems)
      .where(
        sourceModule
          ? eq(evidenceLibraryItems.sourceModule, sourceModule)
          : undefined,
      )
      .orderBy(desc(evidenceLibraryItems.createdAt)),
  );
}

/** The workspace's current brand logo (most recent 'branding' upload), or null. */
export function getCurrentLogo(claims: UserClaims) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({
        id: evidenceLibraryItems.id,
        objectKey: evidenceLibraryItems.objectKey,
        mimeType: evidenceLibraryItems.mimeType,
      })
      .from(evidenceLibraryItems)
      .where(
        and(
          eq(evidenceLibraryItems.sourceModule, "branding"),
          isNotNull(evidenceLibraryItems.objectKey),
        ),
      )
      .orderBy(desc(evidenceLibraryItems.createdAt))
      .limit(1);
    return rows[0] ?? null;
  });
}

/** The object key for a visible item (RLS), or null. Used to sign a download. */
export function getDocumentObjectKey(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .select({ objectKey: evidenceLibraryItems.objectKey })
      .from(evidenceLibraryItems)
      .where(eq(evidenceLibraryItems.id, id))
      .limit(1);
    return rows[0]?.objectKey ?? null;
  });
}

/** Delete the DB row; returns its object key so the route can remove the blob. */
export function deleteDocument(claims: UserClaims, id: string) {
  return withUser(claims, async (tx) => {
    const rows = await tx
      .delete(evidenceLibraryItems)
      .where(
        and(
          eq(evidenceLibraryItems.id, id),
          // Only items that actually carry a binary are "documents".
          isNotNull(evidenceLibraryItems.objectKey),
        ),
      )
      .returning({ objectKey: evidenceLibraryItems.objectKey });
    return rows[0]?.objectKey ?? null;
  });
}
