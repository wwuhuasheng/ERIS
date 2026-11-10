-- ERIS: run in a Supabase project before enabling persistence.
-- Every private row belongs to one Supabase Auth user, including anonymous users.
create extension if not exists pgcrypto;

create table public.scenarios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 2 and 80),
  template_type text not null check (template_type in ('friend','relationship','boundary','work')),
  background text not null check (char_length(background) between 10 and 1200),
  user_role text not null,
  counterpart_role text not null,
  relationship text not null,
  other_position text not null,
  user_intent text not null,
  primary_concern text not null default '',
  unsaid_words text not null default '',
  counterpart_style text not null check (counterpart_style in ('defensive','avoidant','direct','sensitive')),
  intensity integer not null check (intensity between 1 and 3),
  excluded_topics text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  scenario_id uuid not null references public.scenarios(id) on delete cascade,
  parent_session_id uuid,
  branch_from_message_id uuid,
  mode text not null check (mode in ('vent','confront','continue','perspective')),
  active_role text not null default 'user',
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  role text not null check (role in ('user','counterpart','narrator','coach')),
  content text not null check (char_length(content) between 1 and 4000),
  sequence_no integer not null check (sequence_no >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, sequence_no)
);

alter table public.sessions add constraint branch_message_fk foreign key (branch_from_message_id) references public.messages(id) on delete set null;

create table public.scene_states (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  tension integer not null check (tension between 0 and 100),
  openness integer not null check (openness between 0 and 100),
  trust integer not null check (trust between 0 and 100),
  conflict integer not null check (conflict between 0 and 100),
  hurt integer not null check (hurt between 0 and 100),
  expression_coverage integer not null check (expression_coverage between 0 and 100),
  change_reason text not null default '',
  created_at timestamptz not null default now()
);

create table public.turning_points (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  title text not null,
  explanation text not null,
  impact text not null,
  created_at timestamptz not null default now()
);

create table public.session_endings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  core_expression text not null default '',
  peak_moment text not null default '',
  ending_type text not null check (ending_type in ('escalated','stalemate','broken','cooled','exit')),
  optional_reflection text,
  user_feeling text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  feedback_type text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.scenarios add constraint scenarios_id_owner_unique unique (id, owner_id);
alter table public.sessions add constraint sessions_id_owner_unique unique (id, owner_id);
alter table public.messages add constraint messages_id_owner_unique unique (id, owner_id);
alter table public.sessions add constraint sessions_scenario_owner_fk foreign key (scenario_id, owner_id) references public.scenarios(id, owner_id) on delete cascade;
alter table public.sessions add constraint sessions_parent_owner_fk foreign key (parent_session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;
alter table public.messages add constraint messages_session_owner_fk foreign key (session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;
alter table public.scene_states add constraint states_session_owner_fk foreign key (session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;
alter table public.turning_points add constraint points_session_owner_fk foreign key (session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;
alter table public.session_endings add constraint endings_session_owner_fk foreign key (session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;
alter table public.feedback add constraint feedback_session_owner_fk foreign key (session_id, owner_id) references public.sessions(id, owner_id) on delete cascade;

create index scenarios_owner_updated on public.scenarios(owner_id, updated_at desc);
create index sessions_owner_created on public.sessions(owner_id, created_at desc);
create index sessions_scenario on public.sessions(scenario_id);
create index messages_session_sequence on public.messages(session_id, sequence_no);
create index states_session_created on public.scene_states(session_id, created_at desc);
create index points_session on public.turning_points(session_id);
create index feedback_session on public.feedback(session_id);

-- Access is always scoped to the caller. The public anon role gets no policies.
alter table public.scenarios enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.scene_states enable row level security;
alter table public.turning_points enable row level security;
alter table public.session_endings enable row level security;
alter table public.feedback enable row level security;

create policy scenarios_select on public.scenarios for select to authenticated using ((select auth.uid()) = owner_id);
create policy scenarios_insert on public.scenarios for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy scenarios_update on public.scenarios for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy scenarios_delete on public.scenarios for delete to authenticated using ((select auth.uid()) = owner_id);

create policy sessions_select on public.sessions for select to authenticated using ((select auth.uid()) = owner_id);
create policy sessions_insert on public.sessions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy sessions_update on public.sessions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy sessions_delete on public.sessions for delete to authenticated using ((select auth.uid()) = owner_id);

create policy messages_select on public.messages for select to authenticated using ((select auth.uid()) = owner_id);
create policy messages_insert on public.messages for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
);
create policy messages_delete on public.messages for delete to authenticated using ((select auth.uid()) = owner_id);

create policy states_select on public.scene_states for select to authenticated using ((select auth.uid()) = owner_id);
create policy states_insert on public.scene_states for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
);

create policy points_select on public.turning_points for select to authenticated using ((select auth.uid()) = owner_id);
create policy points_insert on public.turning_points for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
);

create policy endings_select on public.session_endings for select to authenticated using ((select auth.uid()) = owner_id);
create policy endings_insert on public.session_endings for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
);
create policy endings_update on public.session_endings for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create policy feedback_select on public.feedback for select to authenticated using ((select auth.uid()) = owner_id);
create policy feedback_insert on public.feedback for insert to authenticated with check (
  (select auth.uid()) = owner_id and exists (select 1 from public.sessions s where s.id = session_id and s.owner_id = (select auth.uid()))
);
