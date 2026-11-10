begin;

update public.companies
set status = 'running'
where status = 'in_progress';

alter table public.companies
  drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check
  check (status in ('selected', 'running', 'pending', 'rejected'));

commit;
