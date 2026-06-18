-- Idle RPG Evolved — cloud save schema.
-- Run this in the Supabase SQL editor (or `supabase db push`).

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row-level security: a user may only read/write their own save row.
alter table public.saves enable row level security;

drop policy if exists "own save - select" on public.saves;
create policy "own save - select" on public.saves
  for select using (auth.uid() = user_id);

drop policy if exists "own save - upsert" on public.saves;
create policy "own save - upsert" on public.saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "own save - update" on public.saves;
create policy "own save - update" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own save - delete" on public.saves;
create policy "own save - delete" on public.saves
  for delete using (auth.uid() = user_id);
