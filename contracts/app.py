"""
HoopConnect — lokalna apka do generowania spersonalizowanych umów.

Uruchom:
    cd contracts
    streamlit run app.py

Otworzy się w przeglądarce (zazwyczaj http://localhost:8501).
"""
import streamlit as st
import os
import re
from datetime import date as date_cls
from generate_umowa import build_pdf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, 'generated')
os.makedirs(OUT_DIR, exist_ok=True)

PL_MONTHS = ['stycznia','lutego','marca','kwietnia','maja','czerwca',
             'lipca','sierpnia','września','października','listopada','grudnia']

def pl_date(d: date_cls) -> str:
    return f'{d.day} {PL_MONTHS[d.month-1]} {d.year} r.'

def slugify(text: str) -> str:
    text = (text or '').strip().lower()
    text = re.sub(r'[^a-z0-9ąćęłńóśźż\s-]+', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text or 'klub'

# ── UI ────────────────────────────────────────────────────────────────────
st.set_page_config(page_title='Umowa HoopConnect', page_icon='🏀', layout='centered')

# Logo + tytuł
logo_path = os.path.join(HERE, 'hoop_logo_512.png')
col1, col2 = st.columns([1, 6])
with col1:
    if os.path.exists(logo_path):
        st.image(logo_path, width=58)
with col2:
    st.markdown('### Generator umowy')
    st.caption('HoopConnect · Not A Slop Mikołaj Krętowicz')

st.divider()

# Form
with st.form('umowa_form'):
    st.markdown('#### Dane Klubu')
    klub_nazwa = st.text_input('Nazwa Klubu / organizacji', placeholder='np. UKS Polonia Warszawa')
    klub_adres = st.text_input('Adres', placeholder='np. ul. Sportowa 5, 00-001 Warszawa')
    klub_nip   = st.text_input('NIP / REGON', placeholder='np. 1234567890')
    klub_repr  = st.text_input('Reprezentowany przez (imię, nazwisko, funkcja)',
                                placeholder='np. Jan Kowalski, Prezes Zarządu')
    klub_email = st.text_input('E-mail kontaktowy', placeholder='np. kontakt@uks-polonia.pl')

    st.markdown('#### Szczegóły umowy')
    col_d, col_m = st.columns(2)
    with col_d:
        data_z = st.date_input('Data zawarcia', value=date_cls.today())
    with col_m:
        miasto = st.text_input('Miasto zawarcia', value='Kłodawa')

    submitted = st.form_submit_button('🏀 Wygeneruj PDF', use_container_width=True, type='primary')

if submitted:
    if not klub_nazwa.strip():
        st.error('Nazwa Klubu jest wymagana.')
    else:
        data = {
            'data_zawarcia':     pl_date(data_z),
            'miasto':            miasto.strip() or 'Kłodawa',
            'klub_nazwa':        klub_nazwa.strip(),
            'klub_adres':        klub_adres.strip(),
            'klub_nip':          klub_nip.strip(),
            'klub_reprezentant': klub_repr.strip(),
            'klub_email':        klub_email.strip(),
        }

        filename = f'umowa_{slugify(klub_nazwa)}_{data_z.isoformat()}.pdf'
        out_path = os.path.join(OUT_DIR, filename)
        try:
            build_pdf(data=data, out_path=out_path)
        except Exception as e:
            st.error(f'Błąd generowania: {e}')
        else:
            st.success(f'✓ Wygenerowano: `{filename}`')
            with open(out_path, 'rb') as f:
                st.download_button(
                    label='⬇️ Pobierz PDF',
                    data=f,
                    file_name=filename,
                    mime='application/pdf',
                    use_container_width=True,
                )
            st.caption(f'Zapisano w: `contracts/generated/{filename}`')

# Sidebar — info i lista wcześniej wygenerowanych
with st.sidebar:
    st.markdown('### Info')
    st.markdown(
        '**Pola puste** → w PDFie pojawią się jako podkreślenia do uzupełnienia ręcznego. '
        'Dlatego nie musisz mieć od razu wszystkich danych Klubu — możesz wygenerować '
        'częściowo wypełnione i resztę dopisać w PDF readerze.'
    )
    st.markdown('---')
    st.markdown('### Historia')
    files = sorted(
        [f for f in os.listdir(OUT_DIR) if f.endswith('.pdf')],
        reverse=True
    )[:15]
    if not files:
        st.caption('_Brak wygenerowanych umów._')
    for f in files:
        st.markdown(f'- `{f}`')
