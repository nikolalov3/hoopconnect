"""
HoopConnect — lokalna apka do generowania spersonalizowanych umów.

Uruchom lokalnie:
    cd contracts
    streamlit run app.py

Lub via skrót pulpitowy: ~/Desktop/HoopConnect Umowy.command

Zdalnie: deployowane na Streamlit Community Cloud pod gu.hoopconnect.pl.
"""
import streamlit as st
import os
import re
import sys
from datetime import date as date_cls
from generate_umowa import build_pdf
from email_helper import (
    is_local_macos, smtp_configured, open_mail_compose, send_email_smtp,
    get_secret,
)

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


# ── PASSWORD GATE ─────────────────────────────────────────────────────────
# Jeśli APP_PASSWORD ustawione w secrets/env → wymagaj logowania.
# Jeśli nie ustawione (lokal dev) → wpuszczamy bez bramki.
def check_password() -> bool:
    expected = get_secret('APP_PASSWORD')
    if not expected:
        return True

    if st.session_state.get('hc_authed'):
        return True

    st.set_page_config(page_title='Generator umów — login', page_icon='🔒', layout='centered')
    st.markdown('## 🔒 Generator umów HoopConnect')
    st.caption('Strefa prywatna. Wpisz hasło dostępowe.')
    pw = st.text_input('Hasło', type='password', label_visibility='collapsed', placeholder='Hasło dostępowe')
    if st.button('Wejdź', type='primary', use_container_width=True):
        if pw == expected:
            st.session_state.hc_authed = True
            st.rerun()
        else:
            st.error('Nieprawidłowe hasło.')
    return False


if not check_password():
    st.stop()


# ── UI ────────────────────────────────────────────────────────────────────
st.set_page_config(page_title='Umowa HoopConnect', page_icon='🏀', layout='centered')

logo_path = os.path.join(HERE, 'hoop_logo_512.png')
col1, col2 = st.columns([1, 6])
with col1:
    if os.path.exists(logo_path):
        st.image(logo_path, width=58)
with col2:
    st.markdown('### Generator umowy')
    st.caption('HoopConnect · Not A Slop Mikołaj Kretowicz')

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

    st.markdown('#### Wysyłka (opcjonalna)')
    send_to = st.text_input(
        'Email do wysłania umowy',
        placeholder='Domyślnie ten sam co kontaktowy klubu. Możesz nadpisać.',
    )

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
            st.session_state['last_pdf']  = out_path
            st.session_state['last_klub'] = klub_nazwa.strip()
            st.session_state['last_to']   = send_to.strip() or klub_email.strip()


# ── AKCJE PO WYGENEROWANIU ────────────────────────────────────────────────
if st.session_state.get('last_pdf') and os.path.exists(st.session_state['last_pdf']):
    last_pdf  = st.session_state['last_pdf']
    last_klub = st.session_state.get('last_klub') or 'klub'
    last_to   = st.session_state.get('last_to', '')

    col_dl, col_mail = st.columns(2)
    with col_dl:
        with open(last_pdf, 'rb') as f:
            st.download_button(
                label='⬇️ Pobierz PDF',
                data=f,
                file_name=os.path.basename(last_pdf),
                mime='application/pdf',
                use_container_width=True,
            )

    # Treść maila do podglądu / wysyłki
    mail_subject = f'Umowa o świadczenie usług — HoopConnect ({last_klub})'
    mail_body = (
        f'Cześć,\n\n'
        f'W załączeniu umowa o świadczenie usług platformy HoopConnect dla {last_klub}.\n\n'
        f'Daj znać jeśli coś wymaga doprecyzowania — zawsze możemy dopisać/zmienić.\n\n'
        f'Pozdrawiam,\n'
        f'Mikołaj Kretowicz\n'
        f'Not A Slop · HoopConnect\n'
        f'kontakt@hoopconnect.pl'
    )

    with col_mail:
        if not last_to:
            st.button('📧 Wyślij mailem',
                      use_container_width=True, disabled=True,
                      help='Wpisz email i wygeneruj ponownie.')
        elif is_local_macos():
            # LOKAL — Mail.app draft
            if st.button('📧 Otwórz w Poczcie', use_container_width=True, type='secondary'):
                try:
                    open_mail_compose(
                        to=last_to,
                        subject=mail_subject,
                        body=mail_body,
                        attachment_path=last_pdf,
                    )
                    st.success(f'✓ Otworzyłem Pocztę z draftem do {last_to}. Kliknij Wyślij w Mail.app.')
                except Exception as e:
                    st.error(f'Nie udało się otworzyć Poczty: {e}')
        elif smtp_configured():
            # ZDALNIE — preview + send
            if st.button('📧 Pokaż podgląd maila', use_container_width=True, type='secondary'):
                st.session_state['show_preview'] = True
        else:
            st.button('📧 Wyślij mailem',
                      use_container_width=True, disabled=True,
                      help='SMTP nieskonfigurowany. Ustaw SMTP_HOST/USER/PASSWORD w secrets.')

    # Podgląd maila (zdalny tryb)
    if st.session_state.get('show_preview') and smtp_configured() and last_to:
        with st.container(border=True):
            st.markdown('**Podgląd maila przed wysłaniem**')
            st.markdown(f'**Do:** {last_to}')
            st.markdown(f'**Temat:** {mail_subject}')
            st.markdown(f'**Załącznik:** `{os.path.basename(last_pdf)}`')
            st.text_area('Treść', value=mail_body, height=200, disabled=True,
                         label_visibility='collapsed')
            c1, c2 = st.columns(2)
            with c1:
                if st.button('Anuluj', use_container_width=True):
                    st.session_state['show_preview'] = False
                    st.rerun()
            with c2:
                if st.button('✉️ Wyślij teraz', use_container_width=True, type='primary'):
                    try:
                        send_email_smtp(
                            to=last_to,
                            subject=mail_subject,
                            body=mail_body,
                            attachment_path=last_pdf,
                        )
                        st.session_state['show_preview'] = False
                        st.success(f'✓ Wysłano do {last_to}.')
                    except Exception as e:
                        st.error(f'Błąd wysyłki: {e}')


# ── SIDEBAR ───────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown('### Info')
    st.markdown(
        '**Pola puste** → w PDFie pojawią się jako podkreślenia do uzupełnienia ręcznego. '
        'Możesz wygenerować częściowo wypełnione umowy i resztę dopisać w PDF readerze.'
    )

    # Tryb wysyłki info
    if is_local_macos():
        st.caption('📬 Tryb wysyłki: **Mail.app** (lokalnie)')
    elif smtp_configured():
        st.caption('📬 Tryb wysyłki: **SMTP** (zdalnie)')
    else:
        st.caption('📬 Tryb wysyłki: **wyłączony** (brak konfiguracji)')

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

    if st.session_state.get('hc_authed'):
        st.markdown('---')
        if st.button('Wyloguj', use_container_width=True):
            st.session_state.hc_authed = False
            st.rerun()
