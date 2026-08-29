-- ============================================================================
-- Courts directory — moved from a static in-bundle array to a DB table so it
-- scales to all of Poland (and beyond) without bloating the bundle, updates
-- without a deploy, and can later hold user-submitted courts.
--
-- The map picker loads only the courts inside the current viewport (a lat/lng
-- bbox query, capped) and renders them on a canvas — so however many rows this
-- table holds, only the visible slice is ever fetched/drawn.
--
-- After running this migration, import supabase/seed/courts_poland.csv into
-- public.courts (Supabase dashboard → Table editor → courts → Import data via
-- CSV; the CSV columns are lat,lng,name,source,osm_type,osm_id). Re-imports are
-- deduped by the unique (osm_type, osm_id) index below.
-- Repo is PUBLIC — no secrets/PII here.
-- ============================================================================

create table if not exists public.courts (
  id         bigint generated always as identity primary key,
  lat        double precision not null,
  lng        double precision not null,
  name       text,
  source     text not null default 'osm' check (source in ('osm', 'user')),
  osm_type   text,
  osm_id     bigint,
  created_by uuid references auth.users(id) on delete set null,  -- for user-submitted
  created_at timestamptz not null default now()
);

-- bbox (viewport) queries: range scan on lat, filter lng. 6.5k rows → instant.
create index if not exists idx_courts_lat on public.courts (lat);
create index if not exists idx_courts_lng on public.courts (lng);

-- Dedup key so re-importing OSM data skips rows already present.
create unique index if not exists uniq_courts_osm on public.courts (osm_type, osm_id)
  where osm_id is not null;

alter table public.courts enable row level security;

-- Public directory — anyone (incl. anon) can read courts.
drop policy if exists "courts readable" on public.courts;
create policy "courts readable" on public.courts for select using (true);

-- NOTE: user-submitted courts (source='user') will need an INSERT path — either a
-- SECURITY DEFINER RPC (validate + insert) or a scoped INSERT policy. Add when that
-- feature ships; for now the table is read-only from clients and seeded from OSM.
