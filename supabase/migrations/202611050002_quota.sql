-- Atomic global cap for the project-funded test account.
-- Only a server using SUPABASE_SECRET_KEY may call the RPC.
create table public.test_usage (
  usage_day date primary key,
  used integer not null default 0 check (used >= 0)
);

revoke all on public.test_usage from public, anon, authenticated;
alter table public.test_usage enable row level security;

create or replace function public.consume_test_quota(p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 100000 then
    raise exception 'invalid quota limit';
  end if;
  insert into public.test_usage (usage_day, used)
  values ((now() at time zone 'UTC')::date, 1)
  on conflict (usage_day) do update
    set used = public.test_usage.used + 1
    where public.test_usage.used < p_limit
  returning used into claimed;
  return claimed is not null;
end;
$$;

revoke execute on function public.consume_test_quota(integer) from public, anon, authenticated;
grant execute on function public.consume_test_quota(integer) to service_role;
