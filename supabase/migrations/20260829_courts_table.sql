-- ============================================================================
-- Courts directory — a READ-ONLY public catalogue of basketball courts, seeded
-- from OpenStreetMap. It scales to all of Poland (and beyond) without bloating
-- the bundle and updates by re-importing the CSV — no deploy needed.
--
-- The map picker loads only the courts inside the current viewport (a lat/lng
-- bbox query, capped) and renders them on a canvas — so however many rows this
-- table holds, only the visible slice is ever fetched/drawn.
--
-- IMPORTANT — courts are NOT user-generated. There is intentionally NO insert/
-- update/delete policy (RLS default-denies writes) and no auth-user linkage, so
-- the app carries no user-submitted-map-point surface. That keeps it clear of the
-- App Store's user-generated-content requirements. Rows are seeded only from
-- public datasets (OSM), server-side (CSV import / service role).
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
  source     text not null default 'osm',   -- provenance of a public dataset (never end-user)
  osm_type   text,
  osm_id     bigint,
  created_at timestamptz not null default now()
);

-- bbox (viewport) queries: range scan on lat, filter lng. Thousands of rows → instant.
create index if not exists idx_courts_lat on public.courts (lat);
create index if not exists idx_courts_lng on public.courts (lng);

-- Dedup key so re-importing OSM data skips rows already present.
create unique index if not exists uniq_courts_osm on public.courts (osm_type, osm_id)
  where osm_id is not null;

alter table public.courts enable row level security;

-- Public directory — anyone (incl. anon) can READ courts. No write policy exists
-- on purpose: RLS default-denies inserts/updates/deletes, so courts can never be
-- added by end users. Seeding is server-side only (CSV import / service role).
drop policy if exists "courts readable" on public.courts;
create policy "courts readable" on public.courts for select using (true);
