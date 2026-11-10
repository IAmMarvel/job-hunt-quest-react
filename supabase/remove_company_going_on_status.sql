begin;

update public.companies
set status = 'running'
where status = 'in_progress';

update public.companies as company
set interview_rounds = (
  select coalesce(
    jsonb_agg(
      jsonb_set(round_item.value, '{status}', '"not_passed"'::jsonb)
      order by round_item.ordinality
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(company.interview_rounds)
    with ordinality as round_item(value, ordinality)
)
where company.status = 'rejected'
  and jsonb_typeof(company.interview_rounds) = 'array';

alter table public.companies
  drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check
  check (status in ('selected', 'running', 'pending', 'rejected'));

commit;
