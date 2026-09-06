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
