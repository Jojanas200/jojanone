import { defineConfig } from "drizzle-kit";

/**
 * Drizzle is used as a TYPED QUERY BUILDER only.
 *
 * Migrations are hand-written SQL in supabase/migrations (the source of truth —
 * they carry RLS policies, functions, triggers and storage that Drizzle can't
 * express). We therefore only ever run `drizzle-kit pull` to (re)generate the
 * Drizzle schema from the live database — never `generate`/`migrate`/`push`.
 *
 *   bun run db:pull    # introspect the DB → src/server/db/schema.ts + relations.ts
 *
 * Introspection uses a DIRECT connection (DIRECT_URL) — the transaction pooler
 * is not suitable for schema introspection.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db",
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});
