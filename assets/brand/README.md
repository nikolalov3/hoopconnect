# Logo HoopConnect z napisem (lockupy PNG)

Sygnet (heks z siateczką — ten ze splasha i ekranu logowania) istnieje w wektorze w `assets/logo-crest.svg` (kopia `public/logo-crest.svg`; `public/hoop.svg` to starsza wersja bez siateczki). Napis „HOOPCONNECT” w aplikacji jest żywym
tekstem (Barlow Condensed 900, `Hoop` = #EEF4FF, `Connect` = #5BB8F5), więc gotowe pliki z napisem
są tylko tutaj. Wszystkie PNG @ ~400 px wysokości liter, przezroczyste poza `*-navy-bg`.

| plik | układ | tło | kiedy użyć |
|---|---|---|---|
| `hoopconnect-horizontal-on-dark.png` | sygnet + napis w poziomie | przezroczyste, biały napis | na własne ciemne tła (banery, stopki, Play Store feature graphic) |
| `hoopconnect-horizontal-navy-bg.png` | poziomo | wypalony granat + poświata | gotowy baner / og:image / nagłówek posta |
| `hoopconnect-horizontal-on-light.png` | poziomo | przezroczyste, granatowy napis | na jasne tła (dokumenty, prasa, 3x3basket.pl) |
| `hoopconnect-stacked-*.png` | sygnet nad napisem (jak ekran logowania) | jw. | kwadratowe miejsca, avatar, plakat |
| `hoopconnect-wordmark-on-dark.png` / `-on-light.png` | sam napis | przezroczyste | obok innego logo / gdy sygnet jest osobno |
| `hoopconnect-sygnet-2048.png` / `-1024.png` | sam sygnet (heks z siateczką) | przezroczyste | ikony, avatary, watermark |

## Regeneracja (np. inny kolor, rozmiar, tagline)
Font nie jest zainstalowany lokalnie, a headless Brave/Chrome na tym Macu się wiesza — dlatego render
robi zwykła przeglądarka (canvas) i wysyła PNG do mini-serwera, który zapisuje je do tego katalogu:

```bash
node assets/brand/generator/server.cjs      # port 3987
```
Potem otwórz http://localhost:3987 w przeglądarce — po 2–3 s pliki są nadpisane (log na stronie i w terminalu).
Warianty i rozmiar (`px=400`) edytuj w `generator/lockup.html` (tablica `V`).
Mniejsze wersje: `npx sharp-cli` albo `node -e 'require("sharp")("assets/brand/X.png").resize({width:1200}).toFile("out.png")'`.

## Grafiki prasowe /rank (`press/`)
- `rank-preview-wide.png` (2400×1350, 16:9) — do nagłówka artykułu; `rank-preview-square.png` (2000×2000) — social.
- `rank-desktop@2x.png` (1440×900 @2x) i `rank-mobile@3x.png` (390×844 @3x) — surowe zrzuty strony, wejście do kompozycji.

Zrzuty robi `generator/cdpshot.cjs` (Brave headless sterowany przez DevTools Protocol; zwykły `--screenshot`
łapie tylko splash, bo strzela przed załadowaniem danych). Skrypt czeka na selektor, potem robi PNG:
```bash
export PROF=/tmp/brave-prof
node assets/brand/generator/cdpshot.cjs "https://hoopconnect.pl/rank" assets/brand/press/rank-desktop@2x.png 1440 900 2 0 ".rk-table tbody tr" 3500
node assets/brand/generator/cdpshot.cjs "https://hoopconnect.pl/rank" assets/brand/press/rank-mobile@3x.png 390 844 3 1 ".rk-table tbody tr" 3500
node assets/brand/generator/cdpshot.cjs "file://$PWD/assets/brand/generator/compose.html?v=wide"   assets/brand/press/rank-preview-wide.png   1200 675  2 0 "#ready" 1500
node assets/brand/generator/cdpshot.cjs "file://$PWD/assets/brand/generator/compose.html?v=square" assets/brand/press/rank-preview-square.png 1000 1000 2 0 "#ready" 1500
```
(argumenty: url, plik, szerokość, wysokość, skala, mobile 0/1, selektor „gotowe”, dodatkowe ms). Układ kompozycji: `generator/compose.html`.
