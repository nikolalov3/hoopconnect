-- ── HC-ID dla profili ─────────────────────────────────────────────────────────
-- Każdy profil dostaje unikalny 5-cyfrowy numer członkowski (10000–99999).
-- Nikola (nikolalovexo@gmail.com) = 14444 na sztywno; 14444 jest zarezerwowane
-- (nigdy nie przydzieli się losowo). Nowe profile dostają numer automatycznie
-- (trigger BEFORE INSERT — działa też dla profili tworzonych przez handle_new_user()).
--
-- Uruchom w Supabase SQL Editor (jednorazowo). Idempotentne — można puścić ponownie.

-- 1) Kolumna
alter table public.profiles add column if not exists hc_id integer;

-- 2) Rezerwacja 14444 dla Nikoli (po e-mailu z auth.users — źródło prawdy)
update public.profiles p
set hc_id = 14444
where p.id = (select id from auth.users where lower(email) = 'nikolalovexo@gmail.com')
  and (p.hc_id is null or p.hc_id <> 14444);

do $$
begin
  if not exists (select 1 from public.profiles where hc_id = 14444) then
    raise notice 'UWAGA: nie znaleziono konta nikolalovexo@gmail.com — HC-ID 14444 NIE zostało przypisane. Ustaw ręcznie po sprawdzeniu e-maila.';
  end if;
end $$;

-- 3) Backfill pozostałych: losowe unikalne 5-cyfrowe, z pominięciem 14444
do $$
declare
  r  record;
  nid integer;
begin
  for r in select id from public.profiles where hc_id is null loop
    loop
      nid := 10000 + floor(random() * 90000)::int;   -- 10000..99999
      exit when nid <> 14444
                and not exists (select 1 from public.profiles where hc_id = nid);
    end loop;
    update public.profiles set hc_id = nid where id = r.id;
  end loop;
end $$;

-- 4) Unikalność + wymagalność
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_hc_id_key') then
    alter table public.profiles add constraint profiles_hc_id_key unique (hc_id);
  end if;
end $$;

alter table public.profiles alter column hc_id set not null;

-- 5) Auto-przydział dla nowych profili (14444 pozostaje zarezerwowane)
create or replace function public.assign_hc_id()
returns trigger
language plpgsql
as $$
begin
  if new.hc_id is null then
    loop
      new.hc_id := 10000 + floor(random() * 90000)::int;
      exit when new.hc_id <> 14444
                and not exists (select 1 from public.profiles where hc_id = new.hc_id);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_hc_id on public.profiles;
create trigger trg_assign_hc_id
  before insert on public.profiles
  for each row execute function public.assign_hc_id();
