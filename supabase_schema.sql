-- ============================================================
-- HoopConnect – Supabase SQL Schema
-- Wklej całość w Supabase SQL Editor i uruchom
-- ============================================================

-- 1. PROFILES (rozszerzenie auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text,
  streak int default 0,
  longest_streak int default 0,
  last_active date,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. TRAININGS (ćwiczenia wgrywane przez admina)
create table if not exists public.trainings (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  type text check (type in ('shooting_3pt', 'shooting_2pt', 'shooting_ft', 'fitness', 'skills', 'dribbling')),
  difficulty int check (difficulty between 1 and 5) default 1,
  target_reps int,               -- np. 150 rzutów
  images text[] default '{}',    -- URL-e ze Supabase Storage
  instructions text[],           -- kroki do ćwiczenia
  scheduled_days int[] default '{1,2,3,4,5,6,7}', -- 1=pon ... 7=nd
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.trainings enable row level security;
create policy "Anyone can read trainings" on public.trainings for select using (true);

-- 3. ACTIVITY LOG (dzienne logi aktywności)
create table if not exists public.activity_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  date date not null default current_date,
  trainings_completed uuid[] default '{}',
  all_done boolean default false,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.activity_log enable row level security;
create policy "Users own activity" on public.activity_log for all using (auth.uid() = user_id);

-- 4. SHOOTING SESSIONS
create table if not exists public.shooting_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  training_id uuid references public.trainings(id),
  shot_type text check (shot_type in ('2pt', '3pt', 'ft')),
  made int default 0,
  attempted int default 0,
  pct numeric(5,2) generated always as (
    case when attempted > 0 then round((made::numeric / attempted) * 100, 2) else 0 end
  ) stored,
  session_date date default current_date,
  created_at timestamptz default now()
);

alter table public.shooting_sessions enable row level security;
create policy "Users own sessions" on public.shooting_sessions for all using (auth.uid() = user_id);

-- 5. QUOTES (cytaty NBA)
create table if not exists public.quotes (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  author text not null,
  image_url text,               -- NBA background photo
  is_active boolean default true
);

alter table public.quotes enable row level security;
create policy "Anyone can read quotes" on public.quotes for select using (is_active = true);

-- Przykładowe cytaty (możesz dodać swoje zdjęcia NBA w Storage)
insert into public.quotes (text, author, image_url) values
  ('Hard work beats talent when talent doesn''t work hard.', 'Tim Notke', null),
  ('I''ve missed more than 9000 shots in my career. I''ve lost almost 300 games. I''ve failed over and over and over again in my life. And that is why I succeed.', 'Michael Jordan', null),
  ('You can''t put a limit on anything. The more you dream, the farther you get.', 'Michael Phelps', null),
  ('Excellence is not a singular act but a habit. You are what you do repeatedly.', 'Shaquille O''Neal', null),
  ('I don''t stop when I''m tired. I stop when I''m done.', 'Kobe Bryant', null),
  ('Winning is not always the barometer of getting better.', 'Tiger Woods', null);

-- 6. ACHIEVEMENTS CATALOG
-- id jest tekstem (np. 'regeneracja', 'allday', 'early_bird') — nie UUID
create table if not exists public.achievements_catalog (
  id text primary key,
  title text not null,
  description text,
  icon text,
  type text check (type in ('staged', 'repeatable')),
  stages jsonb default '[]',        -- [{medal, threshold, image, description}, ...]
  shot_type text,                   -- '2pt', '3pt', 'ft' — dla osiągnięć rzutowych
  training_id uuid references public.trainings(id),  -- dla repeatable po konkretnym treningu
  threshold int,                    -- dla repeatable: co ile ukończeń nagroda
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.achievements_catalog enable row level security;
create policy "Anyone can read achievements" on public.achievements_catalog for select using (true);

-- 7. USER ACHIEVEMENTS (pivot)
-- achievement_id to tekst np. 'regeneracja_bronze', 'early_bird_2026-04-12', 'goat_1'
create table if not exists public.user_achievements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  achievement_id text not null,
  base_id text,                     -- id z achievements_catalog (np. 'regeneracja')
  seen_at timestamptz,              -- null = nieodczytane przez użytkownika
  unlocked_at timestamptz default now()
);

alter table public.user_achievements enable row level security;
create policy "Users own achievements" on public.user_achievements for all using (auth.uid() = user_id);

-- 8. POINTS LOG (punkty za treningi i osiągnięcia)
create table if not exists public.points_log (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  training_id uuid references public.trainings(id),  -- null = punkty za osiągnięcie
  points int not null,
  week_number int not null,
  date date default current_date,
  created_at timestamptz default now()
);

alter table public.points_log enable row level security;
create policy "Users own points" on public.points_log for all using (auth.uid() = user_id);

-- 9. WEEKLY REPORTS
create table if not exists public.weekly_reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  week_number int not null,
  total_points int default 0,
  revealed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, week_number)
);

alter table public.weekly_reports enable row level security;
create policy "Users own reports" on public.weekly_reports for all using (auth.uid() = user_id);

-- ============================================================
-- PRZYKŁADOWE TRENINGI (możesz edytować)
-- ============================================================
insert into public.trainings (title, description, type, difficulty, target_reps, instructions, scheduled_days) values
  (
    'Trójki z narożnika',
    'Klasyczne trójki z prawego i lewego narożnika boiska. Skup się na powtarzalności gestu.',
    'shooting_3pt', 2, 150,
    ARRAY[
      'Ustaw się w narożniku linii trójpunktowej.',
      'Przyjmij niskie ustawienie – nogi szeroko, kolana ugięte.',
      'Weź 5 oddechów i skupia się na tarczy.',
      'Wykonaj 150 rzutów: 75 z prawej, 75 z lewej.',
      'Zapisuj każdy rzut w aplikacji.'
    ],
    ARRAY[1,3,5]
  ),
  (
    'Dwójki ze środka',
    'Rzuty z półdystansu – pozycja 45°. Buduje fundament techniki.',
    'shooting_2pt', 1, 100,
    ARRAY[
      'Stań w połowie odległości do kosza, pod kątem 45°.',
      'Skupiaj się na wysokim łuku rzutu.',
      'Wykonaj 100 rzutów alternując stronę po 25.',
      'Odpoczywaj 30 sekund co 25 rzutów.'
    ],
    ARRAY[1,2,3,4,5,6,7]
  ),
  (
    'Rzuty wolne',
    'Trening mentalny i techniczny. 100 wolnych pod presją czasu.',
    'shooting_ft', 1, 100,
    ARRAY[
      'Stań na linii rzutów wolnych.',
      'Rutyna: 2 kozłowania, głęboki oddech, rzut.',
      'Nie spiesz się – skup na rutynie.',
      'Wykonaj 100 rzutów wolnych.'
    ],
    ARRAY[1,2,3,4,5,6,7]
  ),
  (
    'Trójki off dribble',
    'Trójki po wyjściu z kozłowania. Trudniejsza wersja rzutów statycznych.',
    'shooting_3pt', 3, 100,
    ARRAY[
      'Zacznij z piłką na obwodzie.',
      'Jeden krok do przodu → stop → rzut.',
      'Skup się na zatrzymaniu ciała przed rzutem.',
      '100 rzutów z różnych pozycji.'
    ],
    ARRAY[2,4,6]
  );

-- ============================================================
-- MIGRACJA DLA ISTNIEJĄCYCH BAZ DANYCH
-- Uruchom poniższy blok jeśli masz już starą wersję tabel
-- (jeśli tworzysz bazę od zera — POMIŃ tę sekcję)
-- ============================================================

/*
-- Usuń stare FK i tabele achievements
alter table if exists public.user_achievements
  drop constraint if exists user_achievements_achievement_id_fkey;
alter table if exists public.user_achievements
  drop constraint if exists user_achievements_user_id_achievement_id_key;
drop table if exists public.achievements_catalog cascade;
drop table if exists public.user_achievements cascade;

-- Utwórz nowe (patrz sekcja 6-7 powyżej) — uruchom cały schemat ponownie

-- Dodaj brakujące kolumny jeśli tabele już istnieją:
-- alter table public.user_achievements add column if not exists base_id text;
-- alter table public.user_achievements add column if not exists seen_at timestamptz;

-- Utwórz punkty i raporty jeśli nie istnieją (sekcja 8-9 powyżej)
*/
