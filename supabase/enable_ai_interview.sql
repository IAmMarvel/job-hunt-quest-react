alter table public.companies
  add column if not exists is_ai_interview boolean not null default false;
