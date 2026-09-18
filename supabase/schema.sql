-- CampusPulse AI schema
-- Run in the Supabase SQL editor on a free project.
-- Then run seed.sql and create Auth user admin@campus.local

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
  resolved_at timestamptz
);

create table if not exists public.issue_confirmations (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.issue_clusters (id) on delete cascade,
  client_hash text,
  created_at timestamptz not null default now(),
  unique (cluster_id, client_hash)
);

create index if not exists issues_cluster_idx on public.issues (cluster_id);
create index if not exists issues_status_idx on public.issues (status);
create index if not exists issues_building_idx on public.issues (building);
create index if not exists confirmations_cluster_idx on public.issue_confirmations (cluster_id);

alter table public.issues enable row level security;
alter table public.issue_clusters enable row level security;
alter table public.issue_confirmations enable row level security;

drop policy if exists "public read issues" on public.issues;
create policy "public read issues" on public.issues for select using (true);

drop policy if exists "public read clusters" on public.issue_clusters;
create policy "public read clusters" on public.issue_clusters for select using (true);

drop policy if exists "public read confirmations" on public.issue_confirmations;
create policy "public read confirmations" on public.issue_confirmations for select using (true);

-- Writes go through the Next.js service role. Anon insert kept off on purpose.

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
