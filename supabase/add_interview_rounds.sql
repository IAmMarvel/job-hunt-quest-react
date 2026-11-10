alter table public.companies
  add column if not exists interview_rounds jsonb not null default '[]'::jsonb;

update public.companies as company
set interview_rounds = (
  select jsonb_agg(
    jsonb_build_object(
      'number', round_number,
      'status',
        case
          when round_number = 1
            and company.status = 'running'
            and company.scheduled_at is not null
          then 'scheduled'
          else 'planned'
        end,
      'scheduled_at',
        case when round_number = 1 then company.scheduled_at else null end
    )
    order by round_number
  )
  from generate_series(1, greatest(1, least(company.rounds, 20)))
    as rounds(round_number)
)
where interview_rounds = '[]'::jsonb;
