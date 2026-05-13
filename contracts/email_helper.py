"""
HoopConnect — otwieranie macOS Mail.app z gotowym draftem.

Używamy AppleScript przez `osascript` — nie wymaga konfiguracji SMTP,
hasła ani API. Otwiera natywne okno kompozycji w Mail.app z podpiętym
PDF i wstępnie wypełnionym adresatem + tematem + treścią. Ty tylko
przeglądasz i klikasz Wyślij.
"""
import subprocess
import os


def _escape(s: str) -> str:
    """Bezpiecznie escape'uje string do wstawienia w AppleScript literal."""
    return (s or '').replace('\\', '\\\\').replace('"', '\\"')


def open_mail_compose(to: str, subject: str, body: str, attachment_path: str):
    """
    Otwórz okno kompozycji w Mail.app z gotowym mailem.

    Wszystkie argumenty są stringami. attachment_path musi istnieć.
    Rzuca FileNotFoundError jeśli PDF nie istnieje, RuntimeError jeśli
    osascript zwróci błąd.
    """
    if not os.path.exists(attachment_path):
        raise FileNotFoundError(f'Załącznik nie istnieje: {attachment_path}')

    script = f'''
tell application "Mail"
    activate
    set newMsg to make new outgoing message with properties {{subject:"{_escape(subject)}", content:"{_escape(body)}", visible:true}}
    tell newMsg
        make new to recipient at end of to recipients with properties {{address:"{_escape(to)}"}}
        tell content
            make new attachment with properties {{file name:(POSIX file "{_escape(attachment_path)}")}} at after the last paragraph
        end tell
    end tell
end tell
'''
    proc = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(f'osascript error: {proc.stderr.strip() or proc.stdout.strip()}')
    return True
