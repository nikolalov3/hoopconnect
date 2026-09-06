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

## Grafika postu: Klub / mecz / karta gracza (`press/club-*`)
- `club-preview-wide.png` (16:9) + `club-preview-square.png` (social) — panel zakończonego meczu (statystyki) + karta gracza.
- Źródła: `club-match.png` (karta meczu na ciemnym tle) i `club-playercard.png` (wycinek karty gracza, PRZEZROCZYSTY).

Zrzuty prawdziwych komponentów robimy z dev-labów z tymczasowo podmienionymi mock-danymi (fikcyjny klub
HOOPCONNECT, wymyślone imiona, ramki tylko `early_access`/brak), potem `git checkout` cofa laby:
```bash
# w MatchLab.jsx: klub/imiona/ramki + stan 'completed'; w #cap owinąć <MatchCard/>
node assets/brand/generator/cdpshot.cjs "http://localhost:3000/matchlab" assets/brand/press/club-match.png 480 1000 3 0 "#cap" 3800 "#cap" 0
# w CardLab.jsx: gałąź ?bare renderuje gołą <PlayerCard3D frameVariant=early_access> na przezroczystym tle (html,body,#root transparent)
node assets/brand/generator/cdpshot.cjs "http://localhost:3000/cardlab?bare" assets/brand/press/club-playercard.png 700 1000 3 0 "#cap" 3800 "#cap" 1
git checkout src/pages/MatchLab.jsx src/pages/CardLab.jsx   # cofnij mock-dane
node assets/brand/generator/cdpshot.cjs "file://$PWD/assets/brand/generator/compose-club.html?v=wide"   assets/brand/press/club-preview-wide.png   1200 675  2 0 "#ready" 1500
node assets/brand/generator/cdpshot.cjs "file://$PWD/assets/brand/generator/compose-club.html?v=square" assets/brand/press/club-preview-square.png 1000 1000 2 0 "#ready" 1500
```
`cdpshot.cjs` doszły 2 opcjonalne argumenty: `clipSel` (przytnij do elementu) i `transparent` (0/1, wycinek PNG).

## GIF: sesja meczu zapełnia się (`press/club-session-filling.gif`)
Zakładka Klub (dolne menu, Klub aktywny) — sesja umówionego 3v3 wypełnia się gracz po graczu do kompletu.
`club-session-full.png` = ostatnia klatka (komplet 6/6) jako statyczny obraz.

Pipeline (wszystko w `generator/`):
1. TEMP w `src/pages/MatchLab.jsx`: gałąź `?club&n=N` renderuje ekran Klub (nagłówek HOOPCONNECT + taby +
   prawdziwy `<MatchCard>` ze składem `ALL.slice(0,N)`, ramki tylko early_access/brak) w `#screen`. Cofnij `git checkout` po zrzutach.
2. `gif-capture-frames.cjs` — Brave headless po DevTools Protocol robi klatki #screen dla n=2..6 (jedna sesja,
   BEZ `setDeviceMetricsOverride` — ta metoda WIESZA się na tej stronie; klatka i tak jest przycinana z `scale:3`).
   `PROF=… OUT=… NS='[2,3,4,5,6]' node assets/brand/generator/gif-capture-frames.cjs`
3. `compose-gif.html?f=N` — ramka telefonu + odtworzony dolny dok (Klub aktywny) wokół `screen-N.png`; zrzut przez `cdpshot.cjs` (file://).
4. `gif-encode.cjs` (potrzebuje `npm i --no-save gifenc`) — składa klatki w GIF:
   `FRAMESDIR=… OUT=…/club-session-filling.gif WIDTH=460 SEQ='[[2,650],[3,720],[4,720],[5,720],[6,1900]]' node assets/brand/generator/gif-encode.cjs`
