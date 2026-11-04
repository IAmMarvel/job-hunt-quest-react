alter table public.companies
  add column if not exists scheduled_at timestamptz;
