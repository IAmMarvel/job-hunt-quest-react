create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  title text not null check (char_length(title) between 1 and 120),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create index if not exists notes_user_updated_idx
  on public.notes (user_id, updated_at desc);

alter table public.notes enable row level security;

grant select, insert, update, delete on public.notes to authenticated;

drop policy if exists "Users manage their own notes" on public.notes;
create policy "Users manage their own notes"
  on public.notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
