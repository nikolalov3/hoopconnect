# Generator umów HoopConnect

Lokalna apka w przeglądarce do generowania spersonalizowanych umów z klubami.

## Jak uruchomić

```bash
cd contracts
./run.sh
```

Pierwsze uruchomienie doinstaluje brakujące paczki (`streamlit`, `reportlab`), kolejne
ruszają natychmiast. Apka otworzy się w przeglądarce na `http://localhost:8501`.

## Co robi

1. Wypełniasz formularz: dane Klubu, data zawarcia, miasto
2. Klikasz **Wygeneruj PDF**
3. PDF zapisuje się w `contracts/generated/umowa_<klub>_<data>.pdf`
4. Możesz od razu pobrać przyciskiem **⬇️ Pobierz PDF**

Puste pola w formularzu = podkreślenia w PDFie do uzupełnienia ręcznego.

## Pliki

- `run.sh` — launcher (uruchamia Streamlit + auto-instalacja deps)
- `app.py` — UI Streamlit (formularz)
- `generate_umowa.py` — silnik PDF (`build_pdf(data, out_path)`)
- `hoop_logo_512.png` — logo w nagłówku (rasteryzowane z `/public/hoop.svg`)
- `generated/` — output PDFów (gitignored)
- `umowa_szablon.pdf` — pusty szablon do ręcznego wypełnienia w PDF readerze

## Edycja treści umowy

Wszystkie paragrafy w `generate_umowa.py`. Edytuj → odśwież apkę w przeglądarce
(Streamlit rebootuje sam).

## Regeneracja logo (gdyby SVG się zmieniło)

```bash
sips -s format png -z 512 512 ../public/hoop.svg --out hoop_logo_512.png
```
