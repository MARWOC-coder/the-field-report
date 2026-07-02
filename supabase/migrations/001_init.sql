-- The Field Report — initial schema
-- Gamified KPI tracker for the MARWOC community.
-- All authorization is enforced here (RLS + triggers); the client is untrusted.

-- ============================== TABLES ==============================

create table public.fire_teams (
  id bigint generated always as identity primary key,
  name text not null,
  motto text,
  created_at timestamptz not null default now()
);
create unique index fire_teams_name_lower_idx on public.fire_teams (lower(name));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  callsign text not null,
  role text not null default 'member' check (role in ('member','admin')),
  status text not null default 'pending' check (status in ('pending','active','inactive')),
  fire_team_id bigint references public.fire_teams(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index profiles_callsign_lower_idx on public.profiles (lower(callsign));

create table public.kpi_definitions (
  id bigint generated always as identity primary key,
  key text not null unique,
  label text not null,
  unit_label text not null default '',
  points_per_unit numeric not null check (points_per_unit >= 0),
  category text not null default 'activity' check (category in ('activity','outcome')),
  requires_approval boolean not null default false,
  daily_cap integer check (daily_cap is null or daily_cap > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.kpi_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kpi_id bigint not null references public.kpi_definitions(id) on delete restrict,
  entry_date date not null,
  quantity numeric not null check (quantity >= 0),
  points_each numeric not null default 0,
  status text not null default 'approved' check (status in ('approved','pending','rejected')),
  note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kpi_id, entry_date)
);
create index kpi_entries_date_idx on public.kpi_entries (entry_date);
create index kpi_entries_user_date_idx on public.kpi_entries (user_id, entry_date);
create index kpi_entries_pending_idx on public.kpi_entries (status) where status = 'pending';

create table public.settings (
  key text primary key,
  value jsonb not null
);

-- ============================== HELPERS ==============================

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_active_member(uid uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and status = 'active'
  );
$$;

-- ============================== SIGNUP TRIGGER ==============================

-- New auth users get a profile. Bootstrap admin email becomes an active admin;
-- a correct invite code activates immediately; everyone else waits for approval.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_callsign text;
  v_status text := 'pending';
  v_role text := 'member';
  v_bootstrap text;
  v_invite text;
begin
  v_callsign := nullif(trim(new.raw_user_meta_data->>'callsign'), '');
  if v_callsign is null then
    v_callsign := split_part(new.email, '@', 1);
  end if;
  if exists (select 1 from public.profiles where lower(callsign) = lower(v_callsign)) then
    v_callsign := v_callsign || '-' || substr(new.id::text, 1, 4);
  end if;

  select value #>> '{}' into v_bootstrap from public.settings where key = 'bootstrap_admin_email';
  if v_bootstrap is not null and lower(new.email) = lower(v_bootstrap) then
    v_role := 'admin';
    v_status := 'active';
  else
    select value #>> '{}' into v_invite from public.settings where key = 'invite_code';
    if v_invite is not null and v_invite <> ''
       and lower(coalesce(new.raw_user_meta_data->>'invite_code','')) = lower(v_invite) then
      v_status := 'active';
    end if;
  end if;

  insert into public.profiles (id, full_name, callsign, role, status)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), v_callsign, v_role, v_status);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================== PROFILE GUARD ==============================

-- Members can't touch their own role/status/fire team; the last active admin
-- can't be demoted or deactivated.
create or replace function public.profile_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin((select auth.uid())) then
    new.role := old.role;
    new.status := old.status;
    new.fire_team_id := old.fire_team_id;
  end if;

  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    if not exists (
      select 1 from public.profiles
      where role = 'admin' and status = 'active' and id <> old.id
    ) then
      raise exception 'Cannot remove the last active admin';
    end if;
  end if;
  return new;
end;
$$;

create trigger profile_guard_trg
  before update on public.profiles
  for each row execute procedure public.profile_guard();

-- ============================== ENTRY GUARD ==============================

-- Server-side rules for KPI entries: ownership, date windows, daily caps,
-- point snapshots, approval status. Clients never set points or status.
create or replace function public.kpi_entry_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  def public.kpi_definitions%rowtype;
  actor uuid := (select auth.uid());
  actor_is_admin boolean;
begin
  actor_is_admin := public.is_admin(actor);

  select * into def from public.kpi_definitions where id = new.kpi_id;
  if def.id is null then
    raise exception 'Unknown KPI';
  end if;

  if not actor_is_admin then
    -- +1 day of slack so members ahead of UTC can log their local "today"
    if new.entry_date > (current_date + 1) then
      raise exception 'Cannot log a future date';
    end if;
    if new.entry_date < (current_date - 7) then
      raise exception 'Entries older than 7 days are locked';
    end if;
  end if;

  if def.daily_cap is not null and new.quantity > def.daily_cap then
    new.quantity := def.daily_cap;
  end if;

  if def.requires_approval and new.quantity > 0
     and length(trim(coalesce(new.note, ''))) < 5 then
    raise exception 'This entry needs a note with details (address, terms, etc.)';
  end if;

  if tg_op = 'INSERT' then
    if not actor_is_admin and new.user_id <> actor then
      raise exception 'You can only log your own numbers';
    end if;
    if not def.is_active then
      raise exception 'This KPI is no longer active';
    end if;
    new.points_each := def.points_per_unit;
    new.status := case when def.requires_approval then 'pending' else 'approved' end;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.updated_at := now();
    if not actor_is_admin then
      if old.user_id <> actor then
        raise exception 'You can only edit your own numbers';
      end if;
      -- editing resets outcome entries back into the approval queue
      new.user_id := old.user_id;
      new.kpi_id := old.kpi_id;
      new.entry_date := old.entry_date;
      new.points_each := def.points_per_unit;
      new.status := case when def.requires_approval then 'pending' else 'approved' end;
      new.reviewed_by := null;
      new.reviewed_at := null;
    elsif new.status is distinct from old.status then
      new.reviewed_by := actor;
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger kpi_entry_guard_trg
  before insert or update on public.kpi_entries
  for each row execute procedure public.kpi_entry_guard();

-- ============================== RLS ==============================

alter table public.fire_teams enable row level security;
alter table public.profiles enable row level security;
alter table public.kpi_definitions enable row level security;
alter table public.kpi_entries enable row level security;
alter table public.settings enable row level security;

-- profiles: pending users see only themselves; active members see everyone
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_active_member((select auth.uid())));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- fire teams: visible to all signed-in users; admins manage
create policy fire_teams_select on public.fire_teams for select to authenticated
  using (true);
create policy fire_teams_admin_write on public.fire_teams for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- KPI catalog: readable by all signed-in users; admins manage
create policy kpi_defs_select on public.kpi_definitions for select to authenticated
  using (true);
create policy kpi_defs_admin_write on public.kpi_definitions for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- entries: own rows always; others' approved rows for active members; admins see all
create policy entries_select on public.kpi_entries for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_admin((select auth.uid()))
    or (status = 'approved' and public.is_active_member((select auth.uid())))
  );
create policy entries_insert on public.kpi_entries for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and public.is_active_member((select auth.uid())))
    or public.is_admin((select auth.uid()))
  );
create policy entries_update on public.kpi_entries for update to authenticated
  using (
    (user_id = (select auth.uid()) and public.is_active_member((select auth.uid())))
    or public.is_admin((select auth.uid()))
  );
create policy entries_delete on public.kpi_entries for delete to authenticated
  using (
    (user_id = (select auth.uid()) and entry_date >= current_date - 7)
    or public.is_admin((select auth.uid()))
  );

-- settings hold the invite code — admins only
create policy settings_admin_all on public.settings for all to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ============================== LEADERBOARD RPCS ==============================

-- Mission Complete day = >= 25 points logged (approved or pending) on that date.
-- Points on boards count approved entries only.

create or replace function public.get_leaderboard(p_start date, p_end date)
returns table (
  user_id uuid,
  callsign text,
  full_name text,
  fire_team_id bigint,
  fire_team_name text,
  points numeric,
  activity_points numeric,
  outcome_points numeric,
  mission_days integer,
  career_points numeric
)
language sql stable security definer set search_path = ''
as $$
  with me as (select (select auth.uid()) as uid)
  select
    p.id,
    p.callsign,
    p.full_name,
    p.fire_team_id,
    ft.name,
    coalesce(w.points, 0),
    coalesce(w.activity_points, 0),
    coalesce(w.outcome_points, 0),
    coalesce(m.mission_days, 0),
    coalesce(c.career_points, 0)
  from public.profiles p
  left join public.fire_teams ft on ft.id = p.fire_team_id
  left join (
    select e.user_id,
      sum(e.quantity * e.points_each) as points,
      sum(e.quantity * e.points_each) filter (where d.category = 'activity') as activity_points,
      sum(e.quantity * e.points_each) filter (where d.category = 'outcome') as outcome_points
    from public.kpi_entries e
    join public.kpi_definitions d on d.id = e.kpi_id
    where e.status = 'approved' and e.entry_date between p_start and p_end
    group by e.user_id
  ) w on w.user_id = p.id
  left join (
    select user_id, count(*)::int as mission_days from (
      select user_id, entry_date
      from public.kpi_entries
      where status in ('approved','pending') and entry_date between p_start and p_end
      group by user_id, entry_date
      having sum(quantity * points_each) >= 25
    ) md group by user_id
  ) m on m.user_id = p.id
  left join (
    select user_id, sum(quantity * points_each) as career_points
    from public.kpi_entries
    where status = 'approved'
    group by user_id
  ) c on c.user_id = p.id
  where p.status = 'active'
    and public.is_active_member((select uid from me))
  order by coalesce(w.points, 0) desc, coalesce(m.mission_days, 0) desc, p.callsign asc;
$$;

create or replace function public.get_team_leaderboard(p_start date, p_end date)
returns table (
  team_id bigint,
  team_name text,
  motto text,
  member_count integer,
  total_points numeric,
  avg_points numeric,
  all_hands boolean,
  score numeric
)
language sql stable security definer set search_path = ''
as $$
  with members as (
    select p.id as user_id, p.fire_team_id
    from public.profiles p
    where p.status = 'active' and p.fire_team_id is not null
  ),
  member_stats as (
    select
      m.fire_team_id,
      m.user_id,
      coalesce(sum(e.quantity * e.points_each) filter (where e.status = 'approved'), 0) as points
    from members m
    left join public.kpi_entries e
      on e.user_id = m.user_id and e.entry_date between p_start and p_end
    group by m.fire_team_id, m.user_id
  ),
  mission as (
    select user_id, count(*)::int as mission_days from (
      select user_id, entry_date
      from public.kpi_entries
      where status in ('approved','pending') and entry_date between p_start and p_end
      group by user_id, entry_date
      having sum(quantity * points_each) >= 25
    ) md group by user_id
  ),
  teams as (
    select
      ms.fire_team_id,
      count(*)::int as member_count,
      sum(ms.points) as total_points,
      round(sum(ms.points) / count(*), 1) as avg_points,
      bool_and(coalesce(mi.mission_days, 0) >= 3) as all_hands
    from member_stats ms
    left join mission mi on mi.user_id = ms.user_id
    group by ms.fire_team_id
  )
  select
    ft.id, ft.name, ft.motto,
    t.member_count, t.total_points, t.avg_points, t.all_hands,
    round(t.avg_points * (case when t.all_hands then 1.15 else 1.0 end), 1) as score
  from teams t
  join public.fire_teams ft on ft.id = t.fire_team_id
  where public.is_active_member((select auth.uid()))
  order by score desc, t.total_points desc, ft.name asc;
$$;

create or replace function public.get_recent_wins(p_limit integer default 20)
returns table (
  callsign text,
  kpi_label text,
  quantity numeric,
  points numeric,
  entry_date date,
  reviewed_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select p.callsign, d.label, e.quantity, e.quantity * e.points_each,
         e.entry_date, e.reviewed_at
  from public.kpi_entries e
  join public.kpi_definitions d on d.id = e.kpi_id
  join public.profiles p on p.id = e.user_id
  where e.status = 'approved' and d.category = 'outcome' and e.quantity > 0
    and public.is_active_member((select auth.uid()))
  order by coalesce(e.reviewed_at, e.created_at) desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ============================== PERSONAL STATS ==============================

-- Streaks are weekend-forgiving: missing Sat/Sun never breaks a streak,
-- logging Sat/Sun extends it. p_today is the caller's local date.
create or replace function public.get_my_stats(p_today date default current_date)
returns table (
  career_points numeric,
  today_points numeric,
  current_streak integer,
  best_streak integer,
  mission_today boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_today date := p_today;
  days date[];
  d date;
  earliest date;
  streak int := 0;
  best int := 0;
  run int := 0;
  prev date := null;
  gap_weekdays int;
  guard int := 0;
begin
  if v_today is null or v_today > current_date + 1 or v_today < current_date - 2 then
    v_today := current_date;
  end if;

  select coalesce(sum(quantity * points_each), 0) into career_points
  from public.kpi_entries where user_id = uid and status = 'approved';

  select coalesce(sum(quantity * points_each), 0) into today_points
  from public.kpi_entries
  where user_id = uid and entry_date = v_today and status in ('approved','pending');

  select array_agg(entry_date order by entry_date) into days from (
    select entry_date
    from public.kpi_entries
    where user_id = uid and status in ('approved','pending')
    group by entry_date
    having sum(quantity * points_each) >= 25
  ) md;

  mission_today := days is not null and v_today = any(days);

  if days is null then
    current_streak := 0;
    best_streak := 0;
    return next;
    return;
  end if;

  -- best streak: walk runs, forgiving gaps that contain no weekdays
  foreach d in array days loop
    if prev is null then
      run := 1;
    else
      select count(*)::int into gap_weekdays
      from generate_series(prev + 1, d - 1, interval '1 day') g
      where extract(isodow from g) < 6;
      if gap_weekdays = 0 then
        run := run + 1;
      else
        run := 1;
      end if;
    end if;
    best := greatest(best, run);
    prev := d;
  end loop;

  -- current streak: walk back from today (an unmet today doesn't break it)
  earliest := days[1];
  d := v_today;
  if not (d = any(days)) then
    d := d - 1;
  end if;
  while d >= earliest and guard < 5000 loop
    guard := guard + 1;
    if extract(isodow from d) >= 6 then
      if d = any(days) then
        streak := streak + 1;
      end if;
      d := d - 1;
    elsif d = any(days) then
      streak := streak + 1;
      d := d - 1;
    else
      exit;
    end if;
  end loop;

  current_streak := streak;
  best_streak := best;
  return next;
end;
$$;

-- ============================== GRANTS ==============================

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profile_guard() from public, anon, authenticated;
revoke execute on function public.kpi_entry_guard() from public, anon, authenticated;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_active_member(uuid) to authenticated;
grant execute on function public.get_leaderboard(date, date) to authenticated;
grant execute on function public.get_team_leaderboard(date, date) to authenticated;
grant execute on function public.get_recent_wins(integer) to authenticated;
grant execute on function public.get_my_stats(date) to authenticated;

-- ============================== SEED ==============================

insert into public.settings (key, value) values
  ('bootstrap_admin_email', '"ctc@marwoc.com"'),
  ('invite_code', '"MAKEONELESS"');

insert into public.kpi_definitions
  (key, label, unit_label, points_per_unit, category, requires_approval, daily_cap, sort_order) values
  ('dials',         'Cold Call Dials',        'dials',   1,   'activity', false, 300, 10),
  ('conversations', 'Quality Conversations',  'convos',  10,  'activity', false, 50,  20),
  ('doors',         'Doors Knocked',          'doors',   3,   'activity', false, 100, 30),
  ('d4d',           'D4D Properties Added',   'props',   1,   'activity', false, 100, 40),
  ('mail',          'Direct Mail Sent',       'pieces',  0.1, 'activity', false, 500, 50),
  ('followups',     'Follow-Ups Completed',   'touches', 5,   'activity', false, 50,  60),
  ('leads',         'Qualified Leads Logged', 'leads',   25,  'activity', false, 10,  70),
  ('appts_set',     'Appointments Set',       'appts',   40,  'activity', false, 10,  80),
  ('appts_held',    'Appointments Held',      'appts',   25,  'activity', false, 10,  90),
  ('offers',        'Offers Made',            'offers',  50,  'activity', false, 10,  100),
  ('contracts',     'Contracts Signed',       'contracts', 250, 'outcome', true, 5,   110),
  ('deals',         'Deals Closed',           'deals',   500, 'outcome',  true,  5,   120);
