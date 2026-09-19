
-- Registered QR places and staff-reviewed incident hypotheses. No ticket status is changed.
create table if not exists public.report_locations (
  id uuid primary key, name text not null check (char_length(name) between 3 and 120),
  department text not null check (department in ('IT','Hostel','Mess','Campus','Library')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  created_at timestamptz not null
);
create unique index if not exists cp_location_name on public.report_locations(department, lower(name));
alter table public.issues add column if not exists location_id uuid references public.report_locations(id);
create table if not exists public.campus_incidents (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  kind text not null check (kind in ('power','network','water')),
  issue_ids uuid[] not null check (cardinality(issue_ids) >= 2),
  decision text not null check (decision in ('confirmed','separate')),
  title text not null, place text not null, created_at timestamptz not null, decided_by text not null
);
alter table public.report_locations enable row level security;
alter table public.campus_incidents enable row level security;
revoke all on public.report_locations, public.campus_incidents from anon, authenticated;
grant all on public.report_locations, public.campus_incidents to service_role;
do $$
declare t text;
begin
  foreach t in array array['report_locations','campus_incidents'] loop
    execute format('drop trigger if exists cp_revision on public.%I', t);
    execute format('create trigger cp_revision before insert or update or delete or truncate on public.%I for each statement execute function public.campuspulse_bump_revision()', t);
  end loop;
end $$;
create or replace function public.campuspulse_commit(p_revision bigint, p_changes jsonb) returns bigint
language plpgsql security definer set search_path = pg_catalog, public as $$
declare current_revision bigint; t text; item jsonb; assignments text;
begin
  select revision into current_revision from public.campuspulse_state where id = 1 for update;
  if p_revision is null or current_revision <> p_revision then
    raise exception 'Concurrent update; retry from a fresh snapshot' using errcode = '40001';
  end if;
  -- A fixed table allowlist; all related rows commit or roll back together.
  foreach t in array array['report_locations','issue_clusters','issues','issue_confirmations','issue_verifications','campus_incidents'] loop
    select string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ')
      into assignments from pg_attribute a
      where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> 'id';
    for item in select value from jsonb_array_elements(coalesce(p_changes->t, '[]'::jsonb)) loop
      execute format('insert into public.%1$I select * from jsonb_populate_record(null::public.%1$I, $1) on conflict (id) do update set %2$s', t, assignments) using item;
    end loop;
  end loop;
  if p_changes ? 'campus_boundary' then
    if p_changes->'campus_boundary' = 'null'::jsonb then
      delete from public.campus_boundary where id = 'default';
    else
      insert into public.campus_boundary select * from jsonb_populate_record(null::public.campus_boundary, p_changes->'campus_boundary')
      on conflict (id) do update set kind = excluded.kind, vertices = excluded.vertices, updated_at = excluded.updated_at, updated_by = excluded.updated_by;
    end if;
  end if;
  select revision into current_revision from public.campuspulse_state where id = 1;
  return current_revision;
end $$;

revoke all on function public.campuspulse_commit(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.campuspulse_commit(bigint,jsonb) to service_role;
