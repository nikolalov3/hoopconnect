# Generator umów HoopConnect

Lokalna apka w przeglądarce do generowania spersonalizowanych umów z klubami
+ wysyłka mailem. Dostępna w dwóch trybach:

- **Lokalnie** (Twój Mac) — Mail.app draft, zero config
- **Zdalnie** (Streamlit Cloud, `gu.hoopconnect.pl`) — SMTP, password gate

---

## 🖥 Tryb lokalny

### Uruchomienie

**Najprostszy sposób** — skrót na pulpicie: **HoopConnect Umowy.command** ← dwuklik.

**Z terminala:**
```bash
cd contracts
./run.sh
```

Pierwsze uruchomienie doinstaluje `streamlit` i `reportlab` (~1 min).

### Tryb wysyłki

Apka wykrywa że jest na macOS i używa natywnego **Mail.app** przez AppleScript:
- Klik **📧 Otwórz w Poczcie** → otwiera draft z PDF + adresatem + treścią
- Ty klikasz **Wyślij** w Mail.app — bez SMTP, bez haseł

---

## ☁️ Tryb zdalny (Streamlit Cloud)

URL: `gu.hoopconnect.pl` (po wpięciu domeny)

### Jak zdeployować od zera

1. **Streamlit Cloud signup**
   - Wejdź na [share.streamlit.io](https://share.streamlit.io), zaloguj się przez GitHub
   - **New app** → wybierz repo `nikolalov3/hoopconnect`
   - Branch: `main`
   - **Main file path**: `contracts/app.py`
   - **App URL**: dowolny subdomain `.streamlit.app` (np. `hoopconnect-umowy`)
   - Klik **Deploy**

2. **Skonfiguruj sekrety** (Settings → Secrets)
   Wklej (podmieniając wartości):
   ```toml
   APP_PASSWORD = "twoje-haslo-dostepowe"

   SMTP_HOST = "smtp.gmail.com"
   SMTP_PORT = "587"
   SMTP_USER = "kontakt@hoopconnect.pl"
   SMTP_PASSWORD = "xxxxxxxxxxxxxxxx"
   SMTP_FROM = "kontakt@hoopconnect.pl"
   SMTP_FROM_NAME = "Mikołaj Kretowicz · HoopConnect"
   ```

3. **Wygeneruj Gmail App Password**
   - Google Account → Security → 2-Step Verification (musi być włączone)
   - App passwords → wybierz "Mail" / "Other" → wygeneruj
   - Skopiuj 16-znakowy kod (BEZ spacji) jako `SMTP_PASSWORD`

4. **Podepnij domenę `gu.hoopconnect.pl`**
   - W Hostinger DNS dodaj rekord **CNAME**:
     - **Type:** CNAME
     - **Name:** `gu`
     - **Target:** `<twój-app>.streamlit.app` (z punktu 1)
     - **TTL:** 3600
   - W Streamlit Cloud: Settings → Custom domain → wpisz `gu.hoopconnect.pl`
   - SSL Streamlit wystawi automatycznie (Let's Encrypt, ~5 min)

5. **Test:** wejdź na `gu.hoopconnect.pl`, zaloguj się hasłem, wygeneruj umowę,
   kliknij **Pokaż podgląd maila** → **Wyślij teraz** → mail dotarł.

### Tryb wysyłki w zdalnym

Apka wykrywa że NIE jest na macOS i przełącza się na SMTP:
- Klik **📧 Pokaż podgląd maila** → wyświetla preview (do/temat/treść/załącznik)
- Klik **✉️ Wyślij teraz** → SMTP send
- Sukces → "✓ Wysłano do <email>"

---

## Plik secrets.toml

Lokalnie możesz mieć `contracts/.streamlit/secrets.toml` (gitignored) z tymi samymi
zmiennymi co Streamlit Cloud Secrets. Wzór jest w `secrets.toml.example`.

**NIE commituj prawdziwych haseł — plik jest gitignored.**

---

## Co robi apka

1. Wpisujesz dane Klubu (nazwa, adres, NIP, reprezentant, email)
2. Datę i miasto zawarcia (domyślnie dzisiaj + Kłodawa)
3. (Opcjonalnie) Email do wysyłki — domyślnie ten sam co kontaktowy klubu
4. Klikasz **🏀 Wygeneruj PDF**
5. PDF zapisuje się w `contracts/generated/umowa_<klub>_<data>.pdf`
6. Dwa przyciski po wygenerowaniu: **⬇️ Pobierz PDF** + **📧 Otwórz w Poczcie/Wyślij mailem**

### Puste pola

Pola, których nie wypełnisz w formularzu, pojawią się w PDFie jako podkreślenia
do uzupełnienia ręcznego — np. jeśli klub jeszcze nie ma podanego NIP-u.

---

## Pliki

- `run.sh` — launcher lokalny (uruchamia Streamlit + auto-instalacja deps)
- `app.py` — UI Streamlit (formularz, generowanie, wysyłka, password gate)
- `generate_umowa.py` — silnik PDF (`build_pdf(data, out_path)`)
- `email_helper.py` — dual-mode email (Mail.app local / SMTP remote)
- `hoop_logo_512.png` — logo w nagłówku
- `requirements.txt` — deps dla Streamlit Cloud
- `.streamlit/config.toml` — theme + server config
- `.streamlit/secrets.toml.example` — wzór sekretów
- `generated/` — output PDFów (gitignored)
- `umowa_szablon.pdf` — pusty szablon do ręcznego wypełnienia

## Edycja treści umowy

Wszystkie paragrafy w `generate_umowa.py`. Edytuj → odśwież apkę w przeglądarce
(Streamlit hot-reloaduje sam, lokalnie i na cloudzie).

## Regeneracja logo (gdyby SVG się zmieniło)

```bash
sips -s format png -z 512 512 ../public/hoop.svg --out hoop_logo_512.png
```
