alter table public.companies
  add column if not exists interview_language text
  check (interview_language in ('Java', 'Python'));
