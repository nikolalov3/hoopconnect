-- ============================================================================
-- Cleanup: strip the user-submitted-court scaffolding from an ALREADY-CREATED
-- public.courts table. The first version of 20260829_courts_table.sql shipped a
-- `created_by` auth-user column and a `source` CHECK that allowed 'user' — the
-- start of a "users add courts to the shared map" feature. We are NOT building
-- that (user-generated map points pull the app into the App Store's UGC review
-- requirements, and add moderation/abuse surface). Courts stay a read-only public
-- OSM directory, so this removes the auth linkage and the 'user' provenance value.
--
-- The app already cannot add courts (the table has no INSERT policy — RLS
-- default-denies writes); this just makes the schema match that intent so there's
-- no half-built UGC surface left behind. Idempotent — safe to run once, on the
-- live DB, in the Supabase SQL editor.
-- ============================================================================

-- 1) Drop the auth-user linkage (only existed for user submissions; always NULL).
alter table public.courts drop column if exists created_by;

-- 2) Remove the source CHECK that allowed 'user'. `source` stays as free-text
--    provenance (defaults to 'osm'); clients can't write it anyway.
do $$
declare c text;
begin
  select conname into c
    from pg_constraint
   where conrelid = 'public.courts'::regclass and contype = 'c';
  if c is not null then
    execute format('alter table public.courts drop constraint %I', c);
  end if;
end $$;

-- 3) Belt-and-braces: ensure NO write policy exists on courts (read-only only).
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'courts' and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.courts', p.policyname);
  end loop;
end $$;
