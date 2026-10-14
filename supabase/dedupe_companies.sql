-- Keep the oldest company row for each user and case-insensitive name.
-- Run once in the Supabase SQL Editor to remove existing duplicates.
with ranked_companies as (
  select
    id,
    row_number() over (
      partition by user_id, lower(btrim(name))
      order by created_at asc, id asc
    ) as duplicate_number
  from public.companies
)
delete from public.companies as company
using ranked_companies
where company.id = ranked_companies.id
  and ranked_companies.duplicate_number > 1;
