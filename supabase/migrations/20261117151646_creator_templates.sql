-- Private templates belong to creator accounts. Existing test and phone accounts are unchanged.
create table public.creator_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 80),
  scene_json jsonb not null check (jsonb_typeof(scene_json) = 'object' and pg_column_size(scene_json) <= 20000),
  opening text not null default '' check (char_length(opening) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_templates_owner_updated on public.creator_templates(owner_id, updated_at desc);
alter table public.creator_templates enable row level security;
revoke all on public.creator_templates from anon, authenticated;
grant select, insert, update, delete on public.creator_templates to authenticated;

create policy creator_templates_select on public.creator_templates for select to authenticated
using ((select auth.uid()) = owner_id and (select auth.jwt()->'app_metadata'->>'eris_account_type') = 'creator');
create policy creator_templates_insert on public.creator_templates for insert to authenticated
with check ((select auth.uid()) = owner_id and (select auth.jwt()->'app_metadata'->>'eris_account_type') = 'creator');
create policy creator_templates_update on public.creator_templates for update to authenticated
using ((select auth.uid()) = owner_id and (select auth.jwt()->'app_metadata'->>'eris_account_type') = 'creator')
with check ((select auth.uid()) = owner_id and (select auth.jwt()->'app_metadata'->>'eris_account_type') = 'creator');
create policy creator_templates_delete on public.creator_templates for delete to authenticated
using ((select auth.uid()) = owner_id and (select auth.jwt()->'app_metadata'->>'eris_account_type') = 'creator');
