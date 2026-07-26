-- =============================================================================
-- 0018_jova_memory.sql — Jova long-term memory (semantic recall)
-- pgvector store, one row per remembered fact/interaction, scoped per workspace.
-- Embeddings are 384-dim (all-MiniLM-L6-v2). Standard tenant RLS: any member
-- reads their workspace's memories; writer roles write. Cross-tenant recall is
-- impossible — the vector search runs inside withUser() (RLS).
-- =============================================================================
create extension if not exists vector;

create table public.jova_memories (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  kind          text not null default 'fact', -- profile | onboarding | interaction | fact | note
  title         text,
  content       text not null,
  embedding     vector(384),
  metadata      jsonb not null default '{}'::jsonb,
  source_module text,
  ref_id        uuid,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index jova_memories_ws_idx on public.jova_memories (workspace_id, kind);
-- Approximate nearest-neighbour over cosine distance (normalised embeddings).
create index jova_memories_embedding_idx
  on public.jova_memories using hnsw (embedding vector_cosine_ops);

select public.apply_tenant_rls('jova_memories');
select public.apply_updated_at('jova_memories');
