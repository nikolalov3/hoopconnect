"""
HoopConnect — wysyłka maili w dwóch trybach.

LOKALNIE (macOS):
    Otwiera natywny Mail.app z draftem (review + Send przez Ciebie).
    Brak konfiguracji.

ZDALNIE (Streamlit Cloud / VPS / Linux):
    Wysyła przez SMTP używając env vars / Streamlit secrets:
        SMTP_HOST       (np. smtp.gmail.com)
        SMTP_PORT       (default 587)
        SMTP_USER       (login)
        SMTP_PASSWORD   (App Password — nie zwykłe hasło)
        SMTP_FROM       (opcjonalnie, default = SMTP_USER)
        SMTP_FROM_NAME  (opcjonalnie, default 'HoopConnect')

Funkcja `send_or_compose` automatycznie wybiera tryb.
"""
import os
import sys
import subprocess
import smtplib
from email.message import EmailMessage
from email.utils import formataddr


def _escape_applescript(s: str) -> str:
    """Bezpieczne escape stringów do AppleScript literal."""
    return (s or '').replace('\\', '\\\\').replace('"', '\\"')


def get_secret(key: str, default=None):
    """
    Czyta sekret z Streamlit secrets (st.secrets) jeśli dostępne,
    inaczej z os.environ. Pozwala mieć tę samą logikę lokalnie i na cloudzie.
    """
    try:
        import streamlit as st
        if hasattr(st, 'secrets') and key in st.secrets:
            return st.secrets[key]
    except Exception:
        pass
    return os.environ.get(key, default)


def is_local_macos() -> bool:
    """True jeśli możemy używać natywnego Mail.app."""
    return sys.platform == 'darwin' and get_secret('FORCE_SMTP') != '1'


def smtp_configured() -> bool:
    return all([
        get_secret('SMTP_HOST'),
        get_secret('SMTP_USER'),
        get_secret('SMTP_PASSWORD'),
    ])


def open_mail_compose(to: str, subject: str, body: str, attachment_path: str):
    """
    macOS-only: otwiera okno kompozycji w Mail.app z gotowym mailem.
    Ty przeglądasz i klikasz Wyślij w Mail.app.
    """
    if not os.path.exists(attachment_path):
        raise FileNotFoundError(f'Załącznik nie istnieje: {attachment_path}')

    script = f'''
tell application "Mail"
    activate
    set newMsg to make new outgoing message with properties {{subject:"{_escape_applescript(subject)}", content:"{_escape_applescript(body)}", visible:true}}
    tell newMsg
        make new to recipient at end of to recipients with properties {{address:"{_escape_applescript(to)}"}}
        tell content
            make new attachment with properties {{file name:(POSIX file "{_escape_applescript(attachment_path)}")}} at after the last paragraph
        end tell
    end tell
end tell
'''
    proc = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f'osascript error: {proc.stderr.strip() or proc.stdout.strip()}')
    return True


def send_email_smtp(to: str, subject: str, body: str, attachment_path: str):
    """
    Wysyła maila przez SMTP — używane gdy apka działa zdalnie.
    Wymaga skonfigurowanych SMTP_* w env / Streamlit secrets.
    """
    if not os.path.exists(attachment_path):
        raise FileNotFoundError(f'Załącznik nie istnieje: {attachment_path}')
    if not smtp_configured():
        raise RuntimeError(
            'SMTP nieskonfigurowany. Ustaw SMTP_HOST, SMTP_USER, SMTP_PASSWORD '
            '(i opcjonalnie SMTP_PORT, SMTP_FROM, SMTP_FROM_NAME).'
        )

    host = get_secret('SMTP_HOST')
    port = int(get_secret('SMTP_PORT', 587))
    user = get_secret('SMTP_USER')
    password = get_secret('SMTP_PASSWORD')
    from_addr = get_secret('SMTP_FROM') or user
    from_name = get_secret('SMTP_FROM_NAME', 'HoopConnect')

    msg = EmailMessage()
    msg['From']    = formataddr((from_name, from_addr))
    msg['To']      = to
    msg['Subject'] = subject
    msg.set_content(body)

    with open(attachment_path, 'rb') as f:
        msg.add_attachment(
            f.read(),
            maintype='application',
            subtype='pdf',
            filename=os.path.basename(attachment_path),
        )

    with smtplib.SMTP(host, port, timeout=30) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        smtp.login(user, password)
        smtp.send_message(msg)
    return True


def send_or_compose(to: str, subject: str, body: str, attachment_path: str):
    """
    Auto-wybór trybu wysyłki.
    Zwraca ('mail_compose', True) gdy otwarto Mail.app albo
            ('smtp_sent',    True) gdy wysłano przez SMTP.
    """
    if is_local_macos():
        open_mail_compose(to, subject, body, attachment_path)
        return ('mail_compose', True)
    send_email_smtp(to, subject, body, attachment_path)
    return ('smtp_sent', True)
