-- ============================================================================
-- Miasto w profilu — JEDNA forma kanoniczna ("Kraków", nie "KRK"/"krakow"/"Cracow").
-- Bez tego filtry i przyszłe rankingi po mieście gubią ludzi. Warstwy:
--   • city_aliases (alias → kanoniczna) — WYGENEROWANE z src/lib/city.js (źródło
--     prawdy; klient kanonizuje tą samą regułą, więc nie ma rozjazdu),
--   • normalize_city_key — ta sama normalizacja co w JS (małe litery, bez polskich
--     znaków, kropki/myślniki → spacja, pojedyncze spacje),
--   • trigger na profiles.city — kanonizuje przy każdym zapisie, niezależnie od klienta,
--   • backfill — przepisuje istniejące profile przez trigger.
-- Nieznane miasta przechodzą bez zmian (klient dopisuje je przez Nominatim / Title Case).
-- Idempotentna. Run w Supabase → SQL Editor.
-- ============================================================================

create table if not exists public.city_aliases (
  alias     text primary key,
  canonical text not null
);
alter table public.city_aliases enable row level security;   -- brak polityk = brak dostępu z klienta; czyta tylko trigger

create or replace function public.normalize_city_key(s text)
returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(regexp_replace(
           lower(translate(coalesce(s, ''), 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ', 'acelnoszzacelnoszz')),
           '[._/-]+', ' ', 'g'), '\\s+', ' ', 'g')), '')
$$;

create or replace function public.canonical_city(s text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select a.canonical from public.city_aliases a where a.alias = public.normalize_city_key(s)), s)
$$;

create or replace function public.trg_profiles_canonical_city()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.city is not null then
    new.city := public.canonical_city(btrim(new.city));
    if new.city = '' then new.city := null; end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_canonical_city on public.profiles;
create trigger profiles_canonical_city
  before insert or update of city on public.profiles
  for each row execute function public.trg_profiles_canonical_city();

-- ─── seed (172 aliasów, wygenerowane z src/lib/city.js) ─────────────────
insert into public.city_aliases (alias, canonical) values
  ('krakow', 'Kraków'),
  ('krk', 'Kraków'),
  ('cracow', 'Kraków'),
  ('krakau', 'Kraków'),
  ('krakuf', 'Kraków'),
  ('warszawa', 'Warszawa'),
  ('waw', 'Warszawa'),
  ('wwa', 'Warszawa'),
  ('wawa', 'Warszawa'),
  ('warsaw', 'Warszawa'),
  ('warschau', 'Warszawa'),
  ('wroclaw', 'Wrocław'),
  ('wro', 'Wrocław'),
  ('wrc', 'Wrocław'),
  ('breslau', 'Wrocław'),
  ('poznan', 'Poznań'),
  ('poz', 'Poznań'),
  ('posen', 'Poznań'),
  ('gdansk', 'Gdańsk'),
  ('gda', 'Gdańsk'),
  ('gdn', 'Gdańsk'),
  ('danzig', 'Gdańsk'),
  ('gdynia', 'Gdynia'),
  ('gdy', 'Gdynia'),
  ('sopot', 'Sopot'),
  ('sop', 'Sopot'),
  ('szczecin', 'Szczecin'),
  ('szz', 'Szczecin'),
  ('szn', 'Szczecin'),
  ('stettin', 'Szczecin'),
  ('lodz', 'Łódź'),
  ('ldz', 'Łódź'),
  ('lodsch', 'Łódź'),
  ('katowice', 'Katowice'),
  ('kat', 'Katowice'),
  ('ktw', 'Katowice'),
  ('kato', 'Katowice'),
  ('kattowitz', 'Katowice'),
  ('lublin', 'Lublin'),
  ('lub', 'Lublin'),
  ('lbl', 'Lublin'),
  ('bialystok', 'Białystok'),
  ('bia', 'Białystok'),
  ('rzeszow', 'Rzeszów'),
  ('rze', 'Rzeszów'),
  ('torun', 'Toruń'),
  ('tor', 'Toruń'),
  ('thorn', 'Toruń'),
  ('bydgoszcz', 'Bydgoszcz'),
  ('bdg', 'Bydgoszcz'),
  ('bydg', 'Bydgoszcz'),
  ('kielce', 'Kielce'),
  ('kie', 'Kielce'),
  ('klc', 'Kielce'),
  ('olsztyn', 'Olsztyn'),
  ('ols', 'Olsztyn'),
  ('allenstein', 'Olsztyn'),
  ('opole', 'Opole'),
  ('opo', 'Opole'),
  ('oppeln', 'Opole'),
  ('czestochowa', 'Częstochowa'),
  ('cze', 'Częstochowa'),
  ('czest', 'Częstochowa'),
  ('radom', 'Radom'),
  ('rad', 'Radom'),
  ('rdm', 'Radom'),
  ('gliwice', 'Gliwice'),
  ('gli', 'Gliwice'),
  ('glw', 'Gliwice'),
  ('zabrze', 'Zabrze'),
  ('zab', 'Zabrze'),
  ('bielsko biala', 'Bielsko-Biała'),
  ('bie', 'Bielsko-Biała'),
  ('bielsko', 'Bielsko-Biała'),
  ('bb', 'Bielsko-Biała'),
  ('gorzow wielkopolski', 'Gorzów Wielkopolski'),
  ('gor', 'Gorzów Wielkopolski'),
  ('gorzow', 'Gorzów Wielkopolski'),
  ('gorzow wlkp', 'Gorzów Wielkopolski'),
  ('zielona gora', 'Zielona Góra'),
  ('zie', 'Zielona Góra'),
  ('zg', 'Zielona Góra'),
  ('elblag', 'Elbląg'),
  ('elb', 'Elbląg'),
  ('plock', 'Płock'),
  ('plo', 'Płock'),
  ('tarnow', 'Tarnów'),
  ('tar', 'Tarnów'),
  ('nowy sacz', 'Nowy Sącz'),
  ('nsacz', 'Nowy Sącz'),
  ('ns', 'Nowy Sącz'),
  ('rybnik', 'Rybnik'),
  ('ryb', 'Rybnik'),
  ('tychy', 'Tychy'),
  ('tyc', 'Tychy'),
  ('dabrowa gornicza', 'Dąbrowa Górnicza'),
  ('dg', 'Dąbrowa Górnicza'),
  ('dabrowa', 'Dąbrowa Górnicza'),
  ('sosnowiec', 'Sosnowiec'),
  ('sos', 'Sosnowiec'),
  ('sosno', 'Sosnowiec'),
  ('koszalin', 'Koszalin'),
  ('kos', 'Koszalin'),
  ('kalisz', 'Kalisz'),
  ('kal', 'Kalisz'),
  ('legnica', 'Legnica'),
  ('leg', 'Legnica'),
  ('grudziadz', 'Grudziądz'),
  ('gru', 'Grudziądz'),
  ('slupsk', 'Słupsk'),
  ('slu', 'Słupsk'),
  ('jaworzno', 'Jaworzno'),
  ('jaw', 'Jaworzno'),
  ('jastrzebie zdroj', 'Jastrzębie-Zdrój'),
  ('jastrzebie', 'Jastrzębie-Zdrój'),
  ('jz', 'Jastrzębie-Zdrój'),
  ('walbrzych', 'Wałbrzych'),
  ('wal', 'Wałbrzych'),
  ('chorzow', 'Chorzów'),
  ('cho', 'Chorzów'),
  ('siedlce', 'Siedlce'),
  ('sie', 'Siedlce'),
  ('myslowice', 'Mysłowice'),
  ('pila', 'Piła'),
  ('ostrow wielkopolski', 'Ostrów Wielkopolski'),
  ('ostrow wlkp', 'Ostrów Wielkopolski'),
  ('ostrow', 'Ostrów Wielkopolski'),
  ('lubin', 'Lubin'),
  ('konin', 'Konin'),
  ('inowroclaw', 'Inowrocław'),
  ('ino', 'Inowrocław'),
  ('suwalki', 'Suwałki'),
  ('stargard', 'Stargard'),
  ('gniezno', 'Gniezno'),
  ('siemianowice slaskie', 'Siemianowice Śląskie'),
  ('siemianowice', 'Siemianowice Śląskie'),
  ('glogow', 'Głogów'),
  ('pabianice', 'Pabianice'),
  ('leszno', 'Leszno'),
  ('zory', 'Żory'),
  ('zamosc', 'Zamość'),
  ('pruszkow', 'Pruszków'),
  ('lomza', 'Łomża'),
  ('elk', 'Ełk'),
  ('tarnowskie gory', 'Tarnowskie Góry'),
  ('tg', 'Tarnowskie Góry'),
  ('mielec', 'Mielec'),
  ('tomaszow mazowiecki', 'Tomaszów Mazowiecki'),
  ('tomaszow maz', 'Tomaszów Mazowiecki'),
  ('tomaszow', 'Tomaszów Mazowiecki'),
  ('stalowa wola', 'Stalowa Wola'),
  ('kedzierzyn kozle', 'Kędzierzyn-Koźle'),
  ('kedzierzyn', 'Kędzierzyn-Koźle'),
  ('przemysl', 'Przemyśl'),
  ('swidnica', 'Świdnica'),
  ('bedzin', 'Będzin'),
  ('zgierz', 'Zgierz'),
  ('piotrkow trybunalski', 'Piotrków Trybunalski'),
  ('piotrkow', 'Piotrków Trybunalski'),
  ('piotrkow tryb', 'Piotrków Trybunalski'),
  ('ostroleka', 'Ostrołęka'),
  ('skierniewice', 'Skierniewice'),
  ('starachowice', 'Starachowice'),
  ('wejherowo', 'Wejherowo'),
  ('pulawy', 'Puławy'),
  ('tczew', 'Tczew'),
  ('swinoujscie', 'Świnoujście'),
  ('nysa', 'Nysa'),
  ('zakopane', 'Zakopane'),
  ('zako', 'Zakopane'),
  ('wieliczka', 'Wieliczka'),
  ('skawina', 'Skawina')
on conflict (alias) do update set canonical = excluded.canonical;

-- ─── backfill: istniejące profile przez trigger ────────────────────────────────
update public.profiles set city = city where city is not null;
