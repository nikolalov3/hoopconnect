-- ============================================================================
-- Mecze klubowe — NAPRAWA RLS (root cause zawieszonych meczów) + odzyskanie
-- meczu 23f1f2ad (Love club 11:6, 2026-09-03). Run w Supabase → SQL Editor.
--
-- ROOT CAUSE: polityka matches_update (20260419_matches.sql) miała podzapytanie
--   exists (select 1 from match_players where match_id = id and user_id = auth.uid())
-- match_players MA własną kolumnę `id`, więc niekwalifikowane `id` wiąże się z
-- match_players.id (najbliższy zakres), a `match_id = id` jest ZAWSZE fałszywe.
-- Efekt: UPDATE club_matches mógł zrobić TYLKO twórca meczu. Dla gościa:
--   • claim away_club_id po dołączeniu → 0 wierszy → NULL → "Rywale" zamiast nazwy,
--   • potwierdzenie wyniku → 0 wierszy → "confirmFailed" → mecz wisi w result_pending,
--   • auto-potwierdzenie po 24h → to samo.
-- Sierpniowa poprawka kolejności w kliencie nie mogła tego naprawić — to polityka.
-- Do tego trigger XP wymagał away_club_id, więc nawet ukończony mecz bez claimu
-- nie dawał XP. Tu: polityka z kwalifikowanymi kolumnami + trigger bramkowany na
-- "jest realny przeciwnik" (gracz away w match_players), nie na claim klubu.
-- ============================================================================

-- ─── 1. RLS: uczestnik meczu (wiersz w match_players) może aktualizować mecz ──
drop policy if exists "matches_update" on public.club_matches;
create policy "matches_update"
  on public.club_matches for update
  using (
    auth.uid() = created_by
    or exists (
      select 1 from public.match_players mp
      where mp.match_id = club_matches.id
        and mp.user_id  = auth.uid()
    )
  );

-- ─── 2. Trigger XP: przeciwnik = gracz away w składzie, nie claim klubu ─────
create or replace function public.trg_award_match_xp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r       record;
  v_today date    := current_date;
  v_week  integer := public.calendar_week_number(current_date);
  v_xp    integer;
  v_pts   integer;
  v_won   boolean;
begin
  if NEW.status = 'completed'
     and (OLD.status is distinct from 'completed')
     and NEW.walkover is null
     and NEW.score_home is not null and NEW.score_away is not null
     and exists (select 1 from public.match_players mp where mp.match_id = NEW.id and mp.team = 'away')
  then
    for r in select user_id, team from public.match_players where match_id = NEW.id loop
      v_won := (r.team = 'home' and NEW.score_home > NEW.score_away)
            or (r.team = 'away' and NEW.score_away > NEW.score_home);
      if v_won then v_xp := 75; v_pts := 50; else v_xp := 40; v_pts := 20; end if;   -- remis jak przegrana
      perform public.add_player_xp(r.user_id, v_xp);
      insert into public.points_log (user_id, training_id, points, week_number, date, source, match_id)
      values (r.user_id, null, v_pts, v_week, v_today, 'match', NEW.id)
      on conflict (user_id, match_id, source) where match_id is not null do nothing;   -- idempotentnie
    end loop;
  end if;
  return NEW;
end $$;
-- trigger award_match_xp (after update on club_matches) już wskazuje tę funkcję.

-- ─── 3. ODZYSKANIE meczu 23f1f2ad — Love club 11:6 (gospodarz), 2026-09-03 ──
-- Wynik już jest w bazie (score_home=11, score_away=6). (a) best-effort ustaw
-- away_club_id z klubu gości (W/L klubu-gościa), (b) ukończ → trigger wyżej
-- przyznaje XP/punkty wszystkim w składzie (75/50 wygrana, 40/20 przegrana).
do $$
declare
  v_match uuid := '23f1f2ad-34c1-4ad1-8eb8-8377d5c6e58b';
  v_away  uuid;
  v_n     int;
begin
  select cm.club_id into v_away
    from public.match_players mp
    join public.club_members cm on cm.user_id = mp.user_id
   where mp.match_id = v_match and mp.team = 'away'
   group by cm.club_id order by count(*) desc limit 1;

  if v_away is not null then
    update public.club_matches set away_club_id = v_away where id = v_match and away_club_id is null;
    raise notice 'away_club_id ustawione na %', v_away;
  else
    raise notice 'goście bez klubu — away_club_id zostaje NULL (XP i tak się przyzna)';
  end if;

  update public.club_matches set status = 'completed'
   where id = v_match and status = 'result_pending';
  get diagnostics v_n = row_count;
  raise notice 'ukończono: % wiersz(y) — XP/punkty przyznane przez trigger', v_n;
end $$;

-- ─── 4. Podgląd (uruchom osobno): kto grał + punkty z tego meczu ─────────────
-- select mp.team, mp.slot, p.name, cm.club_id, pl.points
--   from public.match_players mp
--   left join public.profiles p on p.id = mp.user_id
--   left join public.club_members cm on cm.user_id = mp.user_id
--   left join public.points_log pl on pl.user_id = mp.user_id and pl.match_id = mp.match_id and pl.source = 'match'
--  where mp.match_id = '23f1f2ad-34c1-4ad1-8eb8-8377d5c6e58b'
--  order by mp.team, mp.slot;
