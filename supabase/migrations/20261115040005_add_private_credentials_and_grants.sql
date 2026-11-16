-- Upgrade existing ERIS projects without modifying already-applied migrations.
-- Saved DeepSeek keys are encrypted by the server before reaching this table.
create table if not exists public.user_api_credentials (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null,
  updated_at timestamptz not null default now()
);

revoke all on public.user_api_credentials from public, anon, authenticated;
grant select, insert, update, delete on public.user_api_credentials to service_role;
alter table public.user_api_credentials enable row level security;

-- Data API grants are explicit because new projects may not expose tables by default.
-- Existing RLS policies in the initial migration still limit rows to each owner.
grant select, insert, update, delete on public.scenarios to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant select, insert on public.scene_states to authenticated;
grant select, insert on public.turning_points to authenticated;
grant select, insert, update on public.session_endings to authenticated;
grant select, insert on public.feedback to authenticated;

-- Make quota consumption run with the caller's service role privileges.
revoke all on public.test_usage from public, anon, authenticated;
grant select, insert, update on public.test_usage to service_role;
alter function public.consume_test_quota(integer) security invoker;
revoke execute on function public.consume_test_quota(integer) from public, anon, authenticated;
grant execute on function public.consume_test_quota(integer) to service_role;
