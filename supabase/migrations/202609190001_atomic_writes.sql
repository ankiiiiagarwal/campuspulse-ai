
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
