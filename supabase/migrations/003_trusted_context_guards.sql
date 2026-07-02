-- Trigger guards should constrain end users (PostgREST JWT contexts), not
-- trusted contexts (service role / direct SQL), which already bypass RLS.
-- auth.uid() is null in trusted contexts; anon users can't reach these
-- tables at all (no policies grant them access), so null = trusted.

create or replace function public.profile_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is not null and not public.is_admin(actor) then
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

create or replace function public.kpi_entry_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  def public.kpi_definitions%rowtype;
  actor uuid := (select auth.uid());
  trusted boolean;
begin
  trusted := actor is null or public.is_admin(actor);

  select * into def from public.kpi_definitions where id = new.kpi_id;
  if def.id is null then
    raise exception 'Unknown KPI';
  end if;

  if not trusted then
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
    if not trusted and new.user_id <> actor then
      raise exception 'You can only log your own numbers';
    end if;
    if not trusted and not def.is_active then
      raise exception 'This KPI is no longer active';
    end if;
    new.points_each := def.points_per_unit;
    new.status := case when def.requires_approval then 'pending' else 'approved' end;
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.updated_at := now();
    if not trusted then
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
      new.reviewed_by := coalesce(actor, new.reviewed_by);
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;
