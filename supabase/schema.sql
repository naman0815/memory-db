-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor).
-- Creates the backup table with row-level security scoped to each user.

create table if not exists public.memories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null,
  created_at timestamptz not null,
  tags jsonb,
  deleted_at timestamptz
);

alter table public.memories enable row level security;

create policy "own rows select" on public.memories
  for select using (user_id = auth.uid());

create policy "own rows insert" on public.memories
  for insert with check (user_id = auth.uid());

create policy "own rows update" on public.memories
  for update using (user_id = auth.uid());

create index if not exists memories_user_created_idx
  on public.memories (user_id, created_at desc);
