-- ============================================================================
-- Publiczny ranking (/rank) — RPC dla strony bez logowania.
--   rank_board(metryka, miasto, okres, limit) → [{user_id, name, frame, arena, value, …}]
--     • 'xp'      — profiles.xp (XP za mecze i grę; NIE Draft Score — to prywatna metryka)
--     • 'matches' — wygrane mecze klubowe + rozegrane + % wygranych (walkower liczony jak
--                   w statystykach klubu: away_noshow → wygrana gospodarza, home_cancelled →
--                   wygrana gości); okres 'all' | '30d'
--     • 'kotc'    — profiles.kotc_wins (1. miejsca) + liczba ukończonych sesji
--   rank_cities() → miasta z liczbą sklasyfikowanych graczy (chipy filtra).
-- Prywatność: tylko publiczne pola (to, co już eksponuje public_profiles); miasto jest
-- FILTREM, nie kolumną per osoba; profile z flagą anti-cheat (fraud_probability > 0.5)
-- są POMINIĘTE. security definer, wywoływalne przez anon + authenticated. Idempotentna.
-- ============================================================================

-- Próg widoczności miasta w filtrze I w rank_board: mniej niż tyle sklasyfikowanych graczy →
-- miasto ukryte. Jedno pokrętło dla obu funkcji. To także prywatność: "Miasteczko 1" + filtr
-- po tym mieście wskazywałoby jedną konkretną osobę na publicznej stronie.
create or replace function public.rank_min_city_users()
returns int language sql immutable as $$ select 10 $$;

create or replace function public.rank_board(
  p_metric text, p_city text default null, p_period text default 'all', p_limit int default 100
) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_since timestamptz := case when p_period = '30d' then now() - interval '30 days' else null end;
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  -- Miasto poniżej progu: nie filtruj i nie zdradzaj — pusta lista (UI takich miast nie
  -- pokazuje dzięki rank_cities, ale RPC wywołane ręcznie też nie może deanonimizować).
  if p_city is not null and (
       select count(*) from public.profiles p
        where p.city = p_city and p.name is not null and coalesce(p.fraud_probability, 0) <= 0.5
     ) < public.rank_min_city_users() then
    return '[]'::jsonb;
  end if;

  if p_metric = 'xp' then
    return coalesce((select jsonb_agg(r) from (
      select p.id as user_id, p.name, coalesce(p.equipped_frame, 'none') as frame, p.arena_level as arena,
             p.xp as value
        from public.profiles p
       where coalesce(p.fraud_probability, 0) <= 0.5 and p.name is not null and p.xp > 0
         and (p_city is null or p.city = p_city)
       order by p.xp desc, p.name
       limit v_limit) r), '[]'::jsonb);

  elsif p_metric = 'kotc' then
    return coalesce((select jsonb_agg(r) from (
      select p.id as user_id, p.name, coalesce(p.equipped_frame, 'none') as frame, p.arena_level as arena,
             p.kotc_wins as value,
             (select count(distinct sp.session_id)
                from public.kotc_session_players sp
                join public.kotc_sessions s on s.id = sp.session_id
               where sp.user_id = p.id and s.status = 'finished') as played
        from public.profiles p
       where coalesce(p.fraud_probability, 0) <= 0.5 and p.name is not null and coalesce(p.kotc_wins, 0) > 0
         and (p_city is null or p.city = p_city)
       order by p.kotc_wins desc, played desc, p.name
       limit v_limit) r), '[]'::jsonb);

  else  -- 'matches'
    return coalesce((select jsonb_agg(r) from (
      with played as (
        select mp.user_id,
               count(*) as played,
               count(*) filter (where
                    (m.walkover is null and ((mp.team = 'home' and m.score_home > m.score_away)
                                          or (mp.team = 'away' and m.score_away > m.score_home)))
                 or (m.walkover = 'away_noshow'    and mp.team = 'home')
                 or (m.walkover = 'home_cancelled' and mp.team = 'away')) as won
          from public.match_players mp
          join public.club_matches m on m.id = mp.match_id
         where m.status = 'completed'
           and (v_since is null or m.scheduled_at >= v_since)
         group by mp.user_id)
      select p.id as user_id, p.name, coalesce(p.equipped_frame, 'none') as frame, p.arena_level as arena,
             pl.won as value, pl.played, round(100.0 * pl.won / nullif(pl.played, 0)) as pct
        from played pl
        join public.profiles p on p.id = pl.user_id
       where coalesce(p.fraud_probability, 0) <= 0.5 and p.name is not null
         and (p_city is null or p.city = p_city)
       order by pl.won desc, pct desc nulls last, pl.played desc, p.name
       limit v_limit) r), '[]'::jsonb);
  end if;
end $$;

create or replace function public.rank_cities()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('city', c.city, 'n', c.n) order by c.n desc, c.city), '[]'::jsonb)
    from (select p.city, count(*) as n
            from public.profiles p
           where p.city is not null and p.name is not null and coalesce(p.fraud_probability, 0) <= 0.5
           group by p.city
          having count(*) >= public.rank_min_city_users()) c
$$;

revoke all on function public.rank_board(text, text, text, int) from public;
revoke all on function public.rank_cities()                     from public;
grant execute on function public.rank_board(text, text, text, int) to anon, authenticated;
grant execute on function public.rank_cities()                     to anon, authenticated;
