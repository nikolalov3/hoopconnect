"""
HoopConnect — generator umowy o świadczenie usług.

Może być używany na dwa sposoby:

1) Lokalna apka formularzowa (rekomendowane):
       ./run.sh           # uruchamia Streamlit, otwiera browser

2) CLI z pustym szablonem (do ręcznego wypełnienia w PDF reader):
       python3 generate_umowa.py
       → contracts/umowa_szablon.pdf z polami do wypełnienia

3) Z poziomu kodu (z apki):
       from generate_umowa import build_pdf
       build_pdf(data={...}, out_path='...')
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LOGO = os.path.join(HERE, 'hoop_logo_512.png')

# Try to register a Unicode font (DejaVu / Arial on macOS, Linux)
DEFAULT_FONT = 'Helvetica'
DEFAULT_BOLD = 'Helvetica-Bold'
for candidate in [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/Library/Fonts/Arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]:
    if os.path.exists(candidate):
        try:
            pdfmetrics.registerFont(TTFont('UmowaBody', candidate))
            DEFAULT_FONT = 'UmowaBody'
            for b in ['/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                      candidate.replace('.ttf', '-Bold.ttf'),
                      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
                if os.path.exists(b):
                    pdfmetrics.registerFont(TTFont('UmowaBold', b))
                    DEFAULT_BOLD = 'UmowaBold'
                    break
            break
        except Exception:
            pass

NAVY  = colors.HexColor('#1E3A5F')
TEXT  = colors.HexColor('#1A2233')
SUB   = colors.HexColor('#4D5C73')
MUTED = colors.HexColor('#8A9AB0')


def _styles():
    styles = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            'TitleC', parent=styles['Title'],
            fontName=DEFAULT_BOLD, fontSize=18, leading=22, alignment=TA_CENTER,
            textColor=NAVY, spaceAfter=4, spaceBefore=12),
        'subtitle': ParagraphStyle(
            'SubtitleC', parent=styles['Normal'],
            fontName=DEFAULT_FONT, fontSize=10, leading=14, alignment=TA_CENTER,
            textColor=MUTED, spaceAfter=18),
        'h': ParagraphStyle(
            'H', parent=styles['Heading2'],
            fontName=DEFAULT_BOLD, fontSize=12, leading=15,
            textColor=NAVY, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT),
        'body': ParagraphStyle(
            'Body', parent=styles['BodyText'],
            fontName=DEFAULT_FONT, fontSize=10, leading=14,
            textColor=TEXT, spaceAfter=6, alignment=TA_JUSTIFY),
        'list': ParagraphStyle(
            'List', parent=styles['BodyText'],
            fontName=DEFAULT_FONT, fontSize=10, leading=14,
            textColor=TEXT, spaceAfter=4, alignment=TA_JUSTIFY,
            leftIndent=14),
        'subitem': ParagraphStyle(
            'SubItem', parent=styles['BodyText'],
            fontName=DEFAULT_FONT, fontSize=10, leading=14,
            textColor=TEXT, spaceAfter=4, alignment=TA_JUSTIFY,
            leftIndent=28),
    }


def _line(label, value, fallback='____________________________________________________'):
    """Pole 'label: value' — gdy value puste, pokazuje placeholder na podpis."""
    return f'{label}: <b>{value}</b>' if value else f'{label}: {fallback}'


def build_pdf(data=None, out_path=None):
    """
    Wygeneruj PDF umowy.

    data (dict) — pola do wypełnienia (puste pola → pozostawione miejsce do
    wpisania ręcznego w PDF readerze). Klucze:
        - data_zawarcia   (np. '13 maja 2026')
        - miasto          (np. 'Kłodawa')
        - klub_nazwa
        - klub_adres
        - klub_nip
        - klub_reprezentant
        - klub_email

    out_path (str) — ścieżka do PDFa. Default: contracts/umowa_szablon.pdf
    """
    data = data or {}
    out_path = out_path or os.path.join(HERE, 'umowa_szablon.pdf')

    s = _styles()
    doc = SimpleDocTemplate(
        out_path, pagesize=A4,
        leftMargin=22*mm, rightMargin=22*mm,
        topMargin=16*mm, bottomMargin=18*mm,
        title='Umowa o świadczenie usług — HoopConnect',
        author='Not A Slop Mikołaj Krętowicz',
    )

    story = []

    # ── Logo ────────────────────────────────────────────────────────────
    if os.path.exists(LOGO):
        img = Image(LOGO, width=22*mm, height=22*mm)
        img.hAlign = 'CENTER'
        story.append(img)
        story.append(Spacer(1, 4*mm))

    # ── Tytuł ───────────────────────────────────────────────────────────
    story.append(Paragraph('UMOWA O ŚWIADCZENIE USŁUG', s['title']))
    story.append(Paragraph(
        'platforma <b>HoopConnect</b> — panel trenera i aplikacja zawodnika',
        s['subtitle']))

    # ── Intro: data + miasto ────────────────────────────────────────────
    data_z = data.get('data_zawarcia') or '____ ____________ 2026 r.'
    miasto = data.get('miasto') or '________________________'
    intro = f'zawarta w dniu <b>{data_z}</b> w <b>{miasto}</b> pomiędzy:'
    story.append(Paragraph(intro, s['body']))
    story.append(Spacer(1, 4*mm))

    # ── Usługodawca (zawsze ten sam) ────────────────────────────────────
    uslugodawca = (
        '<b>Usługodawcą:</b><br/>'
        'Mikołaj Krętowicz, prowadzący jednoosobową działalność gospodarczą<br/>'
        'pod firmą <b>Not A Slop Mikołaj Krętowicz</b><br/>'
        'NIP: <b>6662124313</b><br/>'
        'Adres: ul. Górnicza 3/9, 62-650 Kłodawa<br/>'
        'E-mail: <b>kontakt@hoopconnect.pl</b><br/>'
        'zwanym dalej <b>„Usługodawcą"</b>.'
    )
    story.append(Paragraph(uslugodawca, s['body']))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph('oraz', s['body']))
    story.append(Spacer(1, 3*mm))

    # ── Klub (dane z formularza) ────────────────────────────────────────
    klub_name  = data.get('klub_nazwa') or '_______________________________________________________________'
    klub_adres = data.get('klub_adres') or '____________________________________________________'
    klub_nip   = data.get('klub_nip')   or '____________________________________________________'
    klub_repr  = data.get('klub_reprezentant') or '____________________________________________________'
    klub_mail  = data.get('klub_email') or '____________________________________________________'

    name_html = f'<b>{klub_name}</b>' if data.get('klub_nazwa') else klub_name

    klub_block = (
        f'<b>Klubem:</b><br/>'
        f'{name_html}<br/>'
        f'(pełna nazwa Klubu / organizacji)<br/><br/>'
        f'Adres: {klub_adres}<br/>'
        f'NIP / REGON: {klub_nip}<br/>'
        f'Reprezentowanym przez: {klub_repr}<br/>'
        f'E-mail kontaktowy: {klub_mail}<br/>'
        f'zwanym dalej <b>„Klubem"</b>.'
    )
    story.append(Paragraph(klub_block, s['body']))

    # ── §1 Przedmiot ────────────────────────────────────────────────────
    story.append(Paragraph('§1 Przedmiot umowy', s['h']))
    story.append(Paragraph(
        '1. Usługodawca świadczy na rzecz Klubu usługę polegającą na udostępnieniu dostępu '
        'do platformy <b>HoopConnect</b> — aplikacji webowej dostępnej pod adresami '
        '<b>trener.hoopconnect.pl</b> (panel trenera) oraz <b>hoopconnect.pl</b> '
        '(aplikacja zawodnika).', s['list']))
    story.append(Paragraph('2. Zakres funkcjonalności obejmuje:', s['list']))
    story.append(Paragraph(
        'a) zarządzanie składem drużyny;<br/>'
        'b) planowanie treningów drużynowych w kalendarzu tygodniowym i miesięcznym;<br/>'
        'c) rejestrację frekwencji zawodników (obecny / spóźniony / nieobecny);<br/>'
        'd) powiadomienia trenera do drużyny lub wybranych zawodników;<br/>'
        'e) statystyki treningowe i osiągnięcia zawodników;<br/>'
        'f) obsługę kategorii wiekowych (U10, U12, U14, U16, U18, Senior) oraz '
        'prowadzenie wielu drużyn w ramach jednego konta trenera.',
        s['subitem']))
    story.append(Paragraph(
        '3. Klub uzyskuje dostęp do platformy w trybie świadczenia usługi (SaaS) — bez '
        'przeniesienia jakichkolwiek praw autorskich do oprogramowania.', s['list']))

    # ── §2 Wynagrodzenie ────────────────────────────────────────────────
    story.append(Paragraph('§2 Wynagrodzenie', s['h']))
    story.append(Paragraph(
        '1. Klub zobowiązuje się płacić Usługodawcy wynagrodzenie miesięczne w wysokości '
        '<b>10,00 zł (dziesięć złotych) netto za każdego zawodnika</b> należącego do drużyn '
        'Klubu na platformie HoopConnect.', s['list']))
    story.append(Paragraph(
        '2. Liczba zawodników podlegająca rozliczeniu ustalana jest na podstawie <b>stanu '
        'składu drużyn z pierwszego dnia danego miesiąca kalendarzowego</b>. Ilu zawodników '
        'jest zapisanych do drużyn Klubu w pierwszym dniu miesiąca, taką liczbę pomnaża się '
        'przez stawkę 10,00 zł netto — i to jest wynagrodzenie należne za ten miesiąc.', s['list']))
    story.append(Paragraph(
        '3. Zawodnicy dołączający do drużyn w trakcie miesiąca <b>nie wpływają</b> na wysokość '
        'wynagrodzenia w bieżącym miesiącu — zostaną uwzględnieni w rozliczeniu kolejnego '
        'miesiąca. Zawodnicy usunięci w trakcie miesiąca pozostają w rozliczeniu tego '
        'miesiąca i znikają z rozliczenia od pierwszego dnia kolejnego miesiąca.', s['list']))
    story.append(Paragraph(
        '4. Do wynagrodzenia zostanie doliczony podatek VAT zgodnie z obowiązującymi '
        'przepisami (jeśli dotyczy).', s['list']))
    story.append(Paragraph(
        '5. Płatność dokonywana jest na podstawie faktury VAT wystawionej przez Usługodawcę '
        'w pierwszych 5 dniach roboczych miesiąca następującego po miesiącu rozliczeniowym, '
        'z terminem płatności <b>14 dni od daty wystawienia</b>, przelewem na rachunek '
        'bankowy Usługodawcy wskazany na fakturze.', s['list']))
    story.append(Paragraph(
        '6. W przypadku opóźnienia w płatności przekraczającego 30 dni Usługodawca '
        'zastrzega sobie prawo do tymczasowego zawieszenia dostępu do platformy do czasu '
        'uregulowania należności.', s['list']))

    # ── §3 Czas trwania ────────────────────────────────────────────────
    story.append(Paragraph('§3 Okres trwania umowy', s['h']))
    story.append(Paragraph(
        '1. Umowa zawarta jest na <b>czas nieokreślony</b>, ze skutkiem od dnia jej '
        'podpisania.', s['list']))
    story.append(Paragraph(
        '2. Każda ze stron ma prawo wypowiedzieć umowę z zachowaniem <b>30-dniowego okresu '
        'wypowiedzenia</b>, złożonego w formie pisemnej lub elektronicznej (e-mail z '
        'potwierdzeniem odbioru).', s['list']))
    story.append(Paragraph(
        '3. Wypowiedzenie nie powoduje natychmiastowej utraty dostępu — Klub może korzystać '
        'z platformy do końca opłaconego okresu rozliczeniowego.', s['list']))
    story.append(Paragraph(
        '4. <b>Pierwszy miesiąc świadczenia usługi jest bezpłatnym okresem testowym.</b> '
        'W tym czasie Klub może wypowiedzieć umowę ze skutkiem natychmiastowym bez '
        'ponoszenia jakichkolwiek kosztów. Pierwsza faktura zostanie wystawiona za drugi '
        'pełny miesiąc świadczenia usługi.', s['list']))

    # ── §4 RODO ────────────────────────────────────────────────────────
    story.append(Paragraph('§4 Ochrona danych osobowych (RODO)', s['h']))
    story.append(Paragraph(
        '1. Usługodawca przetwarza dane osobowe trenerów i zawodników (imię, nazwisko, '
        'adres e-mail, dane treningowe, frekwencja) wyłącznie w zakresie niezbędnym do '
        'świadczenia Usługi i tylko na czas jej trwania.', s['list']))
    story.append(Paragraph(
        '2. Klub oświadcza, że posiada zgody zawodników (lub ich opiekunów prawnych w '
        'przypadku osób niepełnoletnich) na przetwarzanie danych w zakresie wymaganym dla '
        'działania platformy oraz że poinformuje zawodników o korzystaniu z platformy '
        'HoopConnect.', s['list']))
    story.append(Paragraph(
        '3. Usługodawca zobowiązuje się zabezpieczyć dane zgodnie z wymaganiami RODO oraz '
        'nie przekazywać ich osobom trzecim bez wyraźnej zgody, z wyjątkiem podmiotów '
        'wspierających działanie platformy (Supabase, Vercel) na podstawie obowiązujących '
        'umów powierzenia przetwarzania danych.', s['list']))
    story.append(Paragraph(
        '4. Dane zawodnika są usuwane na jego żądanie w terminie do <b>14 dni</b> od '
        'zgłoszenia. Dane Klubu są usuwane w terminie do <b>30 dni</b> od rozwiązania umowy, '
        'chyba że przepisy prawa wymagają dłuższego przechowywania (np. faktury).', s['list']))

    # ── §5 Dostępność i wsparcie ───────────────────────────────────────
    story.append(Paragraph('§5 Dostępność i wsparcie', s['h']))
    story.append(Paragraph(
        '1. Usługodawca dokłada wszelkich starań, aby platforma była dostępna w trybie '
        '24/7. Dopuszczalne są krótkotrwałe przerwy techniczne na konserwację i '
        'aktualizacje, planowane w godzinach nocnych.', s['list']))
    story.append(Paragraph(
        '2. Usługodawca świadczy wsparcie techniczne za pośrednictwem:<br/>'
        '— formularza „Zgłoś / Zapytaj" wbudowanego w panel trenera,<br/>'
        '— kanału Discord HoopConnect.', s['list']))
    story.append(Paragraph(
        '3. Usługodawca zobowiązuje się odpowiedzieć na zgłoszenia w terminie '
        '<b>maksymalnie 3 dni roboczych</b>, a w przypadku awarii blokujących pracę — '
        'niezwłocznie, nie później niż w ciągu 24 godzin.', s['list']))

    # ── §6 Rozwój ──────────────────────────────────────────────────────
    story.append(Paragraph('§6 Rozwój i zmiany funkcjonalności', s['h']))
    story.append(Paragraph(
        '1. Usługodawca zastrzega prawo do rozwijania, zmieniania lub wycofywania '
        'funkcjonalności platformy w celu jej ulepszania.', s['list']))
    story.append(Paragraph(
        '2. O istotnych zmianach wpływających na sposób korzystania z platformy '
        'Usługodawca poinformuje Klub z wyprzedzeniem co najmniej <b>14 dni</b> za '
        'pośrednictwem aplikacji lub adresu e-mail wskazanego przez Klub.', s['list']))

    # ── §7 Odpowiedzialność ────────────────────────────────────────────
    story.append(Paragraph('§7 Ograniczenie odpowiedzialności', s['h']))
    story.append(Paragraph(
        '1. Odpowiedzialność Usługodawcy z tytułu nienależytego wykonania umowy ograniczona '
        'jest do wysokości wynagrodzenia faktycznie zapłaconego przez Klub w okresie 3 '
        'miesięcy poprzedzających powstanie szkody.', s['list']))
    story.append(Paragraph(
        '2. Usługodawca nie odpowiada za utratę danych powstałą z winy Klubu lub zawodnika '
        '(np. samodzielne usunięcie konta, wprowadzenie błędnych danych).', s['list']))

    # ── §8 Końcowe ─────────────────────────────────────────────────────
    story.append(Paragraph('§8 Postanowienia końcowe', s['h']))
    story.append(Paragraph(
        '1. Wszelkie zmiany umowy wymagają formy pisemnej (w tym dokumentowej — wiadomość '
        'e-mail z potwierdzeniem) pod rygorem nieważności.', s['list']))
    story.append(Paragraph(
        '2. W sprawach nieuregulowanych umową zastosowanie mają przepisy Kodeksu cywilnego '
        'oraz ustawy o świadczeniu usług drogą elektroniczną.', s['list']))
    story.append(Paragraph(
        '3. Spory wynikłe z umowy strony będą rozstrzygać polubownie, a w razie '
        'nieosiągnięcia porozumienia — przed sądem właściwym dla siedziby Usługodawcy.',
        s['list']))
    story.append(Paragraph(
        '4. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej '
        'ze stron — lub zawarto elektronicznie z wykorzystaniem podpisu kwalifikowanego, '
        'zaufanego albo poprzez wymianę skanów podpisanych przez upoważnionych '
        'przedstawicieli.', s['list']))

    # ── Podpisy ────────────────────────────────────────────────────────
    story.append(Spacer(1, 14*mm))
    sig_data = [
        ['_______________________________', '_______________________________'],
        ['Usługodawca', 'Klub'],
        ['Mikołaj Krętowicz', '(imię i nazwisko, funkcja)'],
        ['Not A Slop Mikołaj Krętowicz', ''],
        ['data, podpis', 'data, podpis'],
    ]
    sig_table = Table(sig_data, colWidths=[75*mm, 75*mm])
    sig_table.setStyle(TableStyle([
        ('FONTNAME',     (0,0), (-1,-1), DEFAULT_FONT),
        ('FONTSIZE',     (0,0), (-1,-1), 9),
        ('ALIGN',        (0,0), (-1,-1), 'CENTER'),
        ('TEXTCOLOR',    (0,1), (-1,1),  NAVY),
        ('FONTNAME',     (0,1), (-1,1),  DEFAULT_BOLD),
        ('TEXTCOLOR',    (0,2), (-1,-1), SUB),
        ('BOTTOMPADDING',(0,0), (-1,0), 4),
        ('TOPPADDING',   (0,1), (-1,-1), 1),
    ]))
    story.append(sig_table)

    # ── Stopka ─────────────────────────────────────────────────────────
    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(DEFAULT_FONT, 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(22*mm, 10*mm, 'HoopConnect · Not A Slop Mikołaj Krętowicz · NIP 6662124313')
        canvas.drawRightString(A4[0] - 22*mm, 10*mm, f'Strona {doc.page}')
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return out_path


if __name__ == '__main__':
    out = build_pdf()
    print(f'OK -> {out}')
