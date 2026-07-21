// Public entrypoint for the data-access layer.
//
//   withUser(claims, fn)  → user-request-path queries (RLS enforced)
//   adminDb               → trusted server jobs only (RLS bypassed)
//   schema                → Drizzle table definitions (regenerate with `bun run db:pull`)
//
// See src/server/db/README notes and docs/ADR-0001-data-access.md.

export { withUser, type UserClaims } from "./rls";
export { adminDb } from "./admin";
export { db, sqlClient, type Db, type Tx } from "./client";
export * as schema from "./schema";
