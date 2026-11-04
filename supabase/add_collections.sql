create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create unique index if not exists collections_user_name_idx
  on public.collections (user_id, name);

alter table public.companies
  add column if not exists collection_id uuid
  references public.collections (id) on delete cascade;

create index if not exists companies_collection_created_idx
  on public.companies (collection_id, created_at);
create index if not exists collections_user_created_idx
  on public.collections (user_id, created_at);

alter table public.collections enable row level security;

grant select, insert, update, delete on public.collections to authenticated;

drop policy if exists "Users manage their own collections" on public.collections;
create policy "Users manage their own collections"
  on public.collections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own companies" on public.companies;
create policy "Users manage their own companies"
  on public.companies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      collection_id is null
      or exists (
        select 1
        from public.collections
        where collections.id = companies.collection_id
          and collections.user_id = (select auth.uid())
      )
    )
  );

insert into public.collections (user_id, name)
select id, 'Bangalore Interviews'
from auth.users
on conflict (user_id, name) do nothing;

update public.companies as company
set collection_id = collection.id
from public.collections as collection
where collection.user_id = company.user_id
  and collection.name = 'Bangalore Interviews'
  and company.collection_id is null;
