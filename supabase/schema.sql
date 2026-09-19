-- CampusPulse AI schema
-- Run in the Supabase SQL editor on a free project.
-- Production starts empty: do not run seed.sql. Staff access uses server environment credentials.

create extension if not exists "pgcrypto";

create table if not exists public.issue_clusters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null,
  building text not null,
  report_count integer not null default 1,
  me_too_count integer not null default 0,
  priority numeric not null default 0,
  is_recurring boolean not null default false,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'on_it', 'resolved')),
  severity text not null default 'medium',
  created_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  ticket_code text not null unique,
  description text not null,
  category text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  department text not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'on_it', 'resolved')),
  safety integer not null check (safety between 1 and 5),
  location_weight integer not null check (location_weight between 1 and 5),
  priority numeric not null default 0,
  lat double precision not null,
  lng double precision not null,
  building text not null,
  photo_url text,
  resolve_photo_url text,
  eta_at timestamptz,
  embedding jsonb,
  cluster_id uuid not null references public.issue_clusters (id) on delete cascade,
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  resolved_at timestamptz,
  worker_name text,
  escalated_at timestamptz,
  verify_deadline_at timestamptz,
  verified_count integer not null default 0,
  disputed_count integer not null default 0,
  verified_at timestamptz,
  reopen_count integer not null default 0,
  claim_round integer not null default 0
);

-- Existing projects created before worker_name / escalated_at shipped.
alter table public.issues add column if not exists worker_name text;
alter table public.issues add column if not exists escalated_at timestamptz;

-- Existing projects created before student fix verification shipped.
alter table public.issues add column if not exists verify_deadline_at timestamptz;
alter table public.issues add column if not exists verified_count integer not null default 0;
alter table public.issues add column if not exists disputed_count integer not null default 0;
alter table public.issues add column if not exists verified_at timestamptz;
alter table public.issues add column if not exists reopen_count integer not null default 0;
alter table public.issues add column if not exists claim_round integer not null default 0;

create sequence if not exists public.ticket_code_seq start with 1001;

create table if not exists public.issue_confirmations (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.issue_clusters (id) on delete cascade,
  client_hash text,
  created_at timestamptz not null default now(),
  unique (cluster_id, client_hash)
);

-- One anonymous check per browser per fix claim. `round` bumps on every reopen,
-- so a second claim on the same ticket can be checked again by the same browser.
create table if not exists public.issue_verifications (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues (id) on delete cascade,
  cluster_id uuid not null references public.issue_clusters (id) on delete cascade,
  client_hash text not null,
  verdict text not null check (verdict in ('fixed', 'broken')),
  round integer not null default 0,
  photo_url text,
  created_at timestamptz not null default now(),
  unique (issue_id, round, client_hash)
);

create index if not exists issues_cluster_idx on public.issues (cluster_id);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists issues_building_idx on public.issues (building);
create index if not exists confirmations_cluster_idx on public.issue_confirmations (cluster_id);
create index if not exists verifications_issue_idx on public.issue_verifications (issue_id);

alter table public.issues enable row level security;
alter table public.issue_clusters enable row level security;
alter table public.issue_confirmations enable row level security;
alter table public.issue_verifications enable row level security;

drop policy if exists "public read issues" on public.issues;
create policy "public read issues" on public.issues for select using (true);

drop policy if exists "public read clusters" on public.issue_clusters;
create policy "public read clusters" on public.issue_clusters for select using (true);

drop policy if exists "public read confirmations" on public.issue_confirmations;
create policy "public read confirmations" on public.issue_confirmations for select using (true);

-- Anyone may read the audit of fix claims. Writes go through the service role.
drop policy if exists "public read verifications" on public.issue_verifications;
create policy "public read verifications" on public.issue_verifications for select using (true);

create table if not exists public.campus_boundary (
  id text primary key default 'default',
  kind text not null check (kind in ('polygon', 'rectangle')),
  vertices jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.campus_boundary enable row level security;

drop policy if exists "public read campus boundary" on public.campus_boundary;
create policy "public read campus boundary" on public.campus_boundary for select using (true);

-- Writes go through the Next.js service role. Anon insert kept off on purpose.

create table if not exists public.audit_log (
  id uuid primary key,
  at timestamptz not null default now(),
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target text,
  detail text not null,
  ip text,
  prev_hash text not null,
  hash text not null unique
);

create index if not exists audit_log_at_idx on public.audit_log (at);

alter table public.audit_log enable row level security;

create table if not exists public.dept_password_overrides (
  key text primary key,
  password_hash text not null,
  epoch integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by text not null
);

alter table public.dept_password_overrides enable row level security;

insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('resolve-photos', 'resolve-photos', true)
on conflict (id) do nothing;

drop policy if exists "public read report photos" on storage.objects;
create policy "public read report photos"
  on storage.objects for select
  using (bucket_id in ('report-photos', 'resolve-photos'));

drop policy if exists "public upload report photos" on storage.objects;
create policy "public upload report photos"
  on storage.objects for insert
  with check (bucket_id = 'report-photos');

drop policy if exists "admin upload resolve photos" on storage.objects;
create policy "admin upload resolve photos"
  on storage.objects for insert
  with check (bucket_id = 'resolve-photos' and auth.role() = 'authenticated');

-- Atomic application writes. Apply this migration before running the updated server.
create table if not exists public.campuspulse_state (
  id integer primary key check (id = 1), revision bigint not null default 0
);
insert into public.campuspulse_state(id) values (1) on conflict do nothing;
alter table public.campuspulse_state enable row level security;

create or replace function public.campuspulse_bump_revision() returns trigger
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  update public.campuspulse_state set revision = revision + 1 where id = 1;
  return null;
end $$;

-- Statement-level locks precede row locks, including writes made outside the app.
do $$
declare t text;
begin
  foreach t in array array['issues','issue_clusters','issue_confirmations','issue_verifications','campus_boundary'] loop
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
  foreach t in array array['issue_clusters','issues','issue_confirmations','issue_verifications'] loop
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

create table if not exists public.campuspulse_rate_limits (
  key text primary key, hits integer not null, expires_at timestamptz not null
);
alter table public.campuspulse_rate_limits enable row level security;
create index if not exists cp_rate_expiry on public.campuspulse_rate_limits(expires_at);
create or replace function public.campuspulse_rate_limit(p_key text, p_limit integer, p_window_ms integer) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare n integer; stamp timestamptz := clock_timestamp();
begin
  if p_limit < 1 or p_window_ms < 1 then raise exception 'Invalid limit'; end if;
  delete from public.campuspulse_rate_limits where expires_at <= stamp;
  insert into public.campuspulse_rate_limits as r(key,hits,expires_at)
    values(p_key,1,stamp + p_window_ms * interval '1 millisecond')
    on conflict(key) do update set hits = least(r.hits + 1, p_limit + 1)
    returning hits into n;
  return n <= p_limit;
end $$;

create or replace function public.campuspulse_rotate_password(p_key text, p_hash text, p_actor text)
returns public.dept_password_overrides
language plpgsql security definer set search_path = pg_catalog, public as $$
declare saved public.dept_password_overrides;
begin
  insert into public.dept_password_overrides as d(key,password_hash,epoch,updated_at,updated_by)
    values(p_key,p_hash,1,clock_timestamp(),p_actor)
    on conflict(key) do update set password_hash = excluded.password_hash, epoch = d.epoch + 1,
      updated_at = excluded.updated_at, updated_by = excluded.updated_by
    returning * into saved;
  return saved;
end $$;

revoke all on function public.campuspulse_bump_revision() from public, anon, authenticated;
revoke all on function public.campuspulse_commit(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.campuspulse_rate_limit(text,integer,integer) from public, anon, authenticated;
revoke all on function public.campuspulse_rotate_password(text,text,text) from public, anon, authenticated;
grant execute on function public.campuspulse_commit(bigint,jsonb) to service_role;
grant execute on function public.campuspulse_rate_limit(text,integer,integer) to service_role;
grant execute on function public.campuspulse_rotate_password(text,text,text) to service_role;

-- All uploads must pass server decoding and rate limits.
drop policy if exists "public upload report photos" on storage.objects;
drop policy if exists "admin upload resolve photos" on storage.objects;
update storage.buckets set file_size_limit = 4500000,
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id in ('report-photos','resolve-photos');

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

-- Public responses are filtered by the Next.js API. Direct table reads would
-- expose internal fields such as browser hashes and staff identities.
revoke all on public.issues, public.issue_clusters, public.issue_confirmations,
  public.issue_verifications, public.campus_boundary, public.audit_log,
  public.dept_password_overrides, public.campuspulse_state,
  public.campuspulse_rate_limits from anon, authenticated;
grant all on public.issues, public.issue_clusters, public.issue_confirmations,
  public.issue_verifications, public.campus_boundary, public.audit_log,
  public.dept_password_overrides, public.campuspulse_state,
  public.campuspulse_rate_limits to service_role;
