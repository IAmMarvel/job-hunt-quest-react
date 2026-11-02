alter table public.companies
  add column if not exists interview_dates jsonb not null default '[]'::jsonb;
