# Wdrożenie strony hoopconnect.pl + przenosiny apki na app.hoopconnect.pl

Strona (`site/`) jest gotowa i zbudowana (`npm run build` → `site/dist`). Poniżej kroki
**operacyjne** (Vercel/DNS/manifest), których nie da się zrobić z samego kodu. Kolejność ważna,
żeby nie było przerwy dla obecnych użytkowników.

## 0. Zanim ruszysz
- Apka dziś żyje na `hoopconnect.pl` (i `www`). Zostaje bez zmian aż do kroku 3.
- `trener.hoopconnect.pl` i `gu.hoopconnect.pl` — nietknięte przez całą operację.

## 1. Postaw apkę na subdomenie (najpierw!)
1. W istniejącym projekcie Vercel (ten z apką) dodaj domenę **`app.hoopconnect.pl`** (DNS: CNAME → Vercel).
2. Poczekaj aż `https://app.hoopconnect.pl` działa (login, `/rank`, `/dolacz/...`). `main.jsx` nie wymaga zmian — subdomena wpada w gałąź `else → App`.
3. Dopiero gdy apka odpowiada na subdomenie, przejdź dalej.

## 2. Nowy projekt Vercel dla strony
1. Nowy projekt Vercel z tego repo, **Root Directory = `site`**, framework Astro (auto), build `npm run build`, output `dist`.
2. Na razie przypnij testowo pod poddomenę roboczą (np. `www-preview.hoopconnect.pl`) i zweryfikuj strony + redirecty.

## 3. Przełączenie roota (cutover)
1. Przepnij **`hoopconnect.pl` + `www.hoopconnect.pl`** z projektu apki na **projekt strony**.
2. Redirecty starych ścieżek apki są już w `site/vercel.json` (→ `app.hoopconnect.pl/...`): `/auth`, `/onboarding`, `/dolacz/:clubId`, `/shooting/:id`, `/calendar`, `/arena`, `/club`, `/stats`, `/recovery`, `/achievements`, `/kotcsolo`, `/rank`.
3. `hoopconnect.pl/qrhc`, `/terms`, `/privacy` — serwowane statycznie ze strony (skopiowane do `site/public`). Drukowane QR-kody dalej działają, a przyciski na landingu QR prowadzą już do `app.hoopconnect.pl`.

## 4. PWA / manifest apki (po cutoverze)
- W projekcie apki ustaw `start_url` manifestu na `https://app.hoopconnect.pl/` (plik manifestu w apce — **nie zmieniać przed** działającą subdomeną, bo popsuje istniejące instalki).
- Sprawdź, czy zainstalowane PWA (start_url = root) łapią redirect roota → subdomena (kroki 3.2).
- Capacitor: natywna powłoka ma origin `https://localhost`, ale deep-linki/`start_url` webowe się zmieniają — zweryfikować przy pakowaniu (patrz store-readiness).

## 5. Po wdrożeniu — smoke test
- `hoopconnect.pl` → strona (Home/Klub/Ranking/Asystent renderują się, „widok źródła" ma treść).
- `hoopconnect.pl/dolacz/testowy` i `/rank` → 308 na `app.hoopconnect.pl/...`.
- `app.hoopconnect.pl` → apka działa (login, ranking, dołączanie).
- `trener.` / `gu.` → bez zmian.
- Google Search Console: dodaj `hoopconnect.pl` (strona) i wyślij `sitemap-index.xml`.

## Uwaga
Manifestu apki i domen Vercel **nie ruszam z kodu** — to kroki w panelu Vercel/DNS. Reszta (strona, redirecty, landing QR) jest w repo w `site/`.
