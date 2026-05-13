# Generator umów HoopConnect

Lokalna apka w przeglądarce do generowania spersonalizowanych umów z klubami
+ wysyłka mailem przez macOS Mail.app jednym klikiem.

## Jak uruchomić

**Najprostszy sposób** — masz skrót na pulpicie:

> **HoopConnect Umowy.command** ← dwuklik

Otworzy się Terminal i przeglądarka z apką.

**Alternatywnie z terminala:**

```bash
cd contracts
./run.sh
```

Pierwsze uruchomienie doinstaluje `streamlit` i `reportlab` (~1 min).
Kolejne ruszają od razu.

## Co robi

1. Wpisujesz dane Klubu (nazwa, adres, NIP, reprezentant, email)
2. Datę i miasto zawarcia (domyślnie dzisiaj + Kłodawa)
3. (Opcjonalnie) Email do wysyłki — domyślnie ten sam co kontaktowy klubu
4. Klikasz **🏀 Wygeneruj PDF**
5. PDF zapisuje się w `contracts/generated/umowa_<klub>_<data>.pdf`
6. Dwa przyciski po wygenerowaniu:
   - **⬇️ Pobierz PDF** — zapisuje na dysk
   - **📧 Otwórz w Poczcie** — otwiera macOS Mail.app z gotowym draftem
     (adresat + temat + treść + załącznik), Ty przeglądasz i wysyłasz

## Wysyłka mailem

Apka używa natywnego **macOS Mail.app** przez AppleScript:
- Nie potrzebujesz konfigurować SMTP, hasła, App Password
- Działa z każdym kontem które masz dodane do Poczty
- **Ty klikasz Wyślij** — apka tylko otwiera draft

Treść maila jest pre-templated:
```
Cześć,

W załączeniu umowa o świadczenie usług platformy HoopConnect dla {klub}.

Daj znać jeśli coś wymaga doprecyzowania — zawsze możemy dopisać/zmienić.

Pozdrawiam,
Mikołaj Kretowicz
Not A Slop · HoopConnect
kontakt@hoopconnect.pl
```
Możesz ją edytować w oknie Maila przed wysłaniem.

## Puste pola w formularzu

Pola, których nie wypełnisz w formularzu, pojawią się w PDFie jako podkreślenia
do uzupełnienia ręcznego — np. jeśli klub jeszcze nie ma podanego NIP-u.

## Pliki

- `run.sh` — launcher (uruchamia Streamlit + auto-instalacja deps)
- `app.py` — UI Streamlit (formularz, generowanie, wysyłka)
- `generate_umowa.py` — silnik PDF (`build_pdf(data, out_path)`)
- `email_helper.py` — wrapper na osascript do otwierania Mail.app
- `hoop_logo_512.png` — logo w nagłówku (rasteryzowane z `/public/hoop.svg`)
- `generated/` — output PDFów (gitignored)
- `umowa_szablon.pdf` — pusty szablon do ręcznego wypełnienia w PDF readerze

## Skrót pulpitowy

`/Users/nikola/Desktop/HoopConnect Umowy.command` — dwukliki uruchamiają apkę.

Jeśli się zepsuje (np. po przeniesieniu projektu), wystarczy odtworzyć:
```bash
cat > "$HOME/Desktop/HoopConnect Umowy.command" <<'EOF'
#!/usr/bin/env bash
cd "$HOME/Desktop/hoopconnect/hoopconnect/contracts" || exit 1
./run.sh
EOF
chmod +x "$HOME/Desktop/HoopConnect Umowy.command"
```

## Edycja treści umowy

Wszystkie paragrafy w `generate_umowa.py`. Edytuj → odśwież apkę w przeglądarce
(Streamlit hot-reloaduje sam).

## Regeneracja logo (gdyby SVG się zmieniło)

```bash
sips -s format png -z 512 512 ../public/hoop.svg --out hoop_logo_512.png
```
