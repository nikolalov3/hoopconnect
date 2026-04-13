# 🏀 HoopConnect

Aplikacja treningowa dla koszykarzy. Ciemny + pomarańczowy UI.

## Szybki start

### 1. Supabase – utwórz projekt
Wejdź na supabase.com → New Project → darmowy tier.

### 2. Uruchom schemat bazy
Supabase → SQL Editor → wklej plik `supabase_schema.sql` → Run.

### 3. Skopiuj klucze
Supabase → Project Settings → API:
- Project URL → VITE_SUPABASE_URL
- anon public key → VITE_SUPABASE_ANON_KEY

### 4. Utwórz plik .env
```
VITE_SUPABASE_URL=https://TWOJ_PROJEKT.supabase.co
VITE_SUPABASE_ANON_KEY=twoj_anon_key
```

### 5. Uruchom
```bash
npm install
npm run dev
```

## Deploy na Vercel (darmowy)
1. Wrzuć na GitHub
2. Połącz na vercel.com
3. Dodaj zmienne ENV w panelu Vercel
4. Deploy!

## Dodawanie zdjęć NBA (cytaty)
1. Supabase → Storage → New Bucket → nazwa: quotes → Public: TAK
2. Wgraj zdjęcia .jpg
3. Skopiuj URL → wklej do tabeli quotes, kolumna image_url

## Struktura
- src/pages/AuthPage.jsx       – logowanie/rejestracja
- src/pages/HomePage.jsx       – streak, cytaty, lista treningów
- src/pages/ShootingPage.jsx   – tracker rzutów split-screen
- src/pages/StatsPage.jsx      – statystyki strzeleckie
- src/pages/AchievementsPage.jsx – gablota osiągnięć
- src/components/training/TrainingCard.jsx – karta ćwiczenia
- src/components/ui/BottomNav.jsx – dolne menu
- supabase_schema.sql          – cały schemat bazy + przykładowe dane
