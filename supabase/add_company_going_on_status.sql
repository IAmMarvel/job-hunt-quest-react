alter table public.companies
  drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check
  check (status in ('selected', 'running', 'in_progress', 'pending', 'rejected'));
