create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  name text not null check (char_length(name) between 1 and 80),
  rounds integer not null check (rounds between 1 and 20),
  status text not null check (status in ('selected', 'running', 'pending', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  question text not null check (char_length(question) between 1 and 500),
  company text not null,
  topic text not null,
  round text not null,
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  name text not null check (char_length(name) between 1 and 100),
  category text not null,
  status text not null check (status in ('To Learn', 'Learning', 'Practiced', 'Confident')),
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create table if not exists public.motivation_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  legacy_id text,
  line text not null check (char_length(line) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (user_id, legacy_id)
);

create index if not exists companies_user_created_idx
  on public.companies (user_id, created_at);
create index if not exists interview_questions_user_created_idx
  on public.interview_questions (user_id, created_at);
create index if not exists skills_user_created_idx
  on public.skills (user_id, created_at);
create index if not exists motivation_lines_user_created_idx
  on public.motivation_lines (user_id, created_at);

alter table public.companies enable row level security;
alter table public.interview_questions enable row level security;
alter table public.skills enable row level security;
alter table public.motivation_lines enable row level security;

grant select, insert, update, delete
  on public.companies, public.interview_questions, public.skills, public.motivation_lines
  to authenticated;

drop policy if exists "Users manage their own companies" on public.companies;
create policy "Users manage their own companies"
  on public.companies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own interview questions" on public.interview_questions;
create policy "Users manage their own interview questions"
  on public.interview_questions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own skills" on public.skills;
create policy "Users manage their own skills"
  on public.skills for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own motivation lines" on public.motivation_lines;
create policy "Users manage their own motivation lines"
  on public.motivation_lines for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.reset_user_companies(
  p_user_id uuid,
  p_companies jsonb
)
returns setof public.companies
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'Not authorized';
  end if;

  delete from public.companies where user_id = p_user_id;

  return query
    insert into public.companies (user_id, name, rounds, status)
    select p_user_id, seed.name, seed.rounds, seed.status
    from jsonb_to_recordset(p_companies) as seed(
      name text,
      rounds integer,
      status text
    )
    returning *;
end;
$$;

revoke all on function public.reset_user_companies(uuid, jsonb) from public;
grant execute on function public.reset_user_companies(uuid, jsonb) to authenticated;
