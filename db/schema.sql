-- Backup store for Brain 2. Partitioned by sync_key_hash (sha256 of a
-- client-generated random sync code) instead of a real user/auth table —
-- this is a single-user personal app, so a shared-secret "sync code" plays
-- the same role Supabase's magic-link auth + RLS did, without needing an
-- email provider or an accounts system.
create table if not exists memories (
  id uuid primary key,
  sync_key_hash text not null,
  text text not null,
  created_at timestamptz not null,
  tags jsonb,
  deleted_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_memories_sync_key on memories (sync_key_hash);
