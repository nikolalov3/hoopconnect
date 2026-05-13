"""
HoopConnect — generator szablonu umowy o świadczenie usług.

Wyplywa: umowa_szablon.pdf w tym samym folderze.
Logo HoopConnect (icon-512.png) wycentrowane w nagłówku.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    PageBreak, KeepTogether
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# Główne logo aplikacji — niebieski gradient hex z /hoop.svg, zrasteryzowany
# do 512px PNG przez `sips` (macOS) bo reportlab nie obsługuje SVG natywnie.
# Komenda do regeneracji jeśli SVG się zmieni:
#   sips -s format png -z 512 512 ../public/hoop.svg --out hoop_logo_512.png
LOGO = os.path.join(HERE, 'hoop_logo_512.png')
OUT  = os.path.join(HERE, 'umowa_szablon.pdf')

# Try to register a Unicode font (DejaVu Sans is bundled on most macOS/Linux)
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
            bold = candidate.replace('.ttf', '-Bold.ttf').replace('Arial', 'Arial Bold')
            for b in [bold, '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
                      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
                if os.path.exists(b):
                    pdfmetrics.registerFont(TTFont('UmowaBold', b))
                    DEFAULT_BOLD = 'UmowaBold'
                    break
            break
        except Exception:
            pass

# Style
NAVY = colors.HexColor('#1E3A5F')
BLUE = colors.HexColor('#5591CD')
TEXT = colors.HexColor('#1A2233')
SUB  = colors.HexColor('#4D5C73')
MUTED = colors.HexColor('#8A9AB0')

styles = getSampleStyleSheet()

title_style = ParagraphStyle(
    'TitleC', parent=styles['Title'],
    fontName=DEFAULT_BOLD, fontSize=18, leading=22, alignment=TA_CENTER,
    textColor=NAVY, spaceAfter=4, spaceBefore=12,
)
subtitle_style = ParagraphStyle(
    'SubtitleC', parent=styles['Normal'],
    fontName=DEFAULT_FONT, fontSize=10, leading=14, alignment=TA_CENTER,
    textColor=MUTED, spaceAfter=18,
)
h_style = ParagraphStyle(
    'H', parent=styles['Heading2'],
    fontName=DEFAULT_BOLD, fontSize=12, leading=15,
    textColor=NAVY, spaceBefore=14, spaceAfter=6, alignment=TA_LEFT,
)
body_style = ParagraphStyle(
    'Body', parent=styles['BodyText'],
    fontName=DEFAULT_FONT, fontSize=10, leading=14,
    textColor=TEXT, spaceAfter=6, alignment=TA_JUSTIFY,
)
list_style = ParagraphStyle(
    'List', parent=body_style,
    leftIndent=14, spaceAfter=4,
)
small_style = ParagraphStyle(
    'Small', parent=styles['Normal'],
    fontName=DEFAULT_FONT, fontSize=9, leading=12,
    textColor=SUB, alignment=TA_LEFT,
)

doc = SimpleDocTemplate(
    OUT, pagesize=A4,
    leftMargin=22*mm, rightMargin=22*mm,
    topMargin=16*mm, bottomMargin=18*mm,
    title='Umowa o świadczenie usług — HoopConnect',
    author='Not A Slop Mikołaj Kretowicz',
)

story = []

# ── Logo wycentrowane ──────────────────────────────────────────────────────
if os.path.exists(LOGO):
    img = Image(LOGO, width=22*mm, height=22*mm)
    img.hAlign = 'CENTER'
    story.append(img)
    story.append(Spacer(1, 4*mm))

# ── Tytuł ──────────────────────────────────────────────────────────────────
story.append(Paragraph('UMOWA O ŚWIADCZENIE USŁUG', title_style))
story.append(Paragraph('platforma <b>HoopConnect</b> — panel trenera i aplikacja zawodnika',
                       subtitle_style))

# ── Strony ─────────────────────────────────────────────────────────────────
intro = (
    'zawarta w dniu <b>____ ____________ 2026 r.</b> w <b>________________________</b> pomiędzy:'
)
story.append(Paragraph(intro, body_style))
story.append(Spacer(1, 4*mm))

uslugodawca_block = (
    '<b>Usługodawcą:</b><br/>'
    'Mikołaj Krętowicz, prowadzący jednoosobową działalność gospodarczą<br/>'
    'pod firmą <b>Not A Slop Mikołaj Krętowicz</b><br/>'
    'NIP: <b>6662124313</b><br/>'
    'Adres: ____________________________________________________<br/>'
    'E-mail: ____________________________________________________<br/>'
    'zwanym dalej <b>„Usługodawcą"</b>.'
)
story.append(Paragraph(uslugodawca_block, body_style))
story.append(Spacer(1, 3*mm))
story.append(Paragraph('oraz', body_style))
story.append(Spacer(1, 3*mm))

klub_block = (
    '<b>Klubem:</b><br/>'
    '_______________________________________________________________<br/>'
    '(pełna nazwa Klubu / organizacji)<br/><br/>'
    'Adres: ____________________________________________________<br/>'
    'NIP / REGON: ____________________________________________________<br/>'
    'Reprezentowanym przez: ____________________________________________________<br/>'
    'E-mail kontaktowy: ____________________________________________________<br/>'
    'zwanym dalej <b>„Klubem"</b>.'
)
story.append(Paragraph(klub_block, body_style))

# ── §1 Przedmiot ───────────────────────────────────────────────────────────
story.append(Paragraph('§1 Przedmiot umowy', h_style))
story.append(Paragraph(
    '1. Usługodawca świadczy na rzecz Klubu usługę polegającą na udostępnieniu dostępu '
    'do platformy <b>HoopConnect</b> — aplikacji webowej dostępnej pod adresami '
    '<b>trener.hoopconnect.pl</b> (panel trenera) oraz <b>hoopconnect.pl</b> (aplikacja zawodnika).',
    list_style))
story.append(Paragraph(
    '2. Zakres funkcjonalności obejmuje w szczególności:', list_style))
story.append(Paragraph(
    'a) zarządzanie składem drużyny (zaproszenia zawodników, edycja danych);<br/>'
    'b) planowanie treningów drużynowych w widoku tygodniowym i miesięcznym;<br/>'
    'c) rejestrację frekwencji zawodników (obecny / spóźniony / nieobecny);<br/>'
    'd) wewnątrzaplikacyjne powiadomienia trenera do drużyny lub wybranych zawodników, '
    'wraz z historią i możliwością cofnięcia;<br/>'
    'e) indywidualne statystyki treningowe zawodników (kategorie, seria treningowa, '
    'osiągnięcia);<br/>'
    'f) obsługę wielu drużyn w ramach jednego konta trenera.',
    ParagraphStyle('subitem', parent=list_style, leftIndent=28)))
story.append(Paragraph(
    '3. Klub uzyskuje dostęp do platformy w trybie świadczenia usługi (SaaS) — bez '
    'przeniesienia jakichkolwiek praw autorskich do oprogramowania.', list_style))

# ── §2 Wynagrodzenie ───────────────────────────────────────────────────────
story.append(Paragraph('§2 Wynagrodzenie', h_style))
story.append(Paragraph(
    '1. Klub zobowiązuje się płacić Usługodawcy wynagrodzenie miesięczne w wysokości '
    '<b>10,00 zł (dziesięć złotych) netto za każdego aktywnego zawodnika</b> '
    'zapisanego do drużyn prowadzonych przez Klub w panelu trenera.', list_style))
story.append(Paragraph(
    '2. Do wynagrodzenia zostanie doliczony podatek VAT zgodnie z obowiązującymi przepisami '
    '(jeśli dotyczy).', list_style))
story.append(Paragraph(
    '3. <b>„Aktywny zawodnik"</b> oznacza zawodnika, który w okresie rozliczeniowym '
    '(kalendarzowy miesiąc) figurował w składzie którejkolwiek z drużyn prowadzonych przez '
    'Klub na platformie. Zawodnik, który dołączył lub został usunięty w trakcie miesiąca, '
    'liczony jest proporcjonalnie do liczby dni członkostwa.', list_style))
story.append(Paragraph(
    '4. Płatność dokonywana jest na podstawie faktury VAT wystawionej przez Usługodawcę '
    'w pierwszych 5 dniach roboczych miesiąca następującego po miesiącu rozliczeniowym, '
    'z terminem płatności <b>14 dni od daty wystawienia</b>.', list_style))
story.append(Paragraph(
    '5. Płatność dokonywana jest przelewem na rachunek bankowy Usługodawcy wskazany na '
    'fakturze.', list_style))
story.append(Paragraph(
    '6. W przypadku opóźnienia w płatności przekraczającego 30 dni Usługodawca zastrzega '
    'sobie prawo do tymczasowego zawieszenia dostępu do platformy do czasu uregulowania '
    'należności.', list_style))

# ── §3 Okres trwania ───────────────────────────────────────────────────────
story.append(Paragraph('§3 Okres trwania umowy', h_style))
story.append(Paragraph(
    '1. Umowa zawarta jest na <b>czas nieokreślony</b>, ze skutkiem od dnia jej podpisania.',
    list_style))
story.append(Paragraph(
    '2. Każda ze stron ma prawo wypowiedzieć umowę z zachowaniem <b>30-dniowego okresu '
    'wypowiedzenia</b>, złożonego w formie pisemnej lub elektronicznej (e-mail z '
    'potwierdzeniem odbioru).', list_style))
story.append(Paragraph(
    '3. Wypowiedzenie nie powoduje natychmiastowej utraty dostępu — Klub może korzystać '
    'z platformy do końca opłaconego okresu rozliczeniowego.', list_style))
story.append(Paragraph(
    '4. Pierwszy miesiąc świadczenia usługi jest <b>bezpłatnym okresem testowym</b>. '
    'W tym czasie Klub może wypowiedzieć umowę ze skutkiem natychmiastowym bez ponoszenia '
    'kosztów.', list_style))

# ── §4 RODO ────────────────────────────────────────────────────────────────
story.append(Paragraph('§4 Ochrona danych osobowych (RODO)', h_style))
story.append(Paragraph(
    '1. Usługodawca przetwarza dane osobowe trenerów i zawodników (imię, nazwisko, '
    'adres e-mail, dane treningowe, frekwencja) wyłącznie w zakresie niezbędnym do '
    'świadczenia Usługi i tylko na czas jej trwania.', list_style))
story.append(Paragraph(
    '2. Klub oświadcza, że posiada zgody zawodników (lub ich opiekunów prawnych w przypadku '
    'osób niepełnoletnich) na przetwarzanie danych w zakresie wymaganym dla działania '
    'platformy oraz że poinformuje zawodników o korzystaniu z platformy HoopConnect.', list_style))
story.append(Paragraph(
    '3. Usługodawca zobowiązuje się zabezpieczyć dane zgodnie z wymaganiami RODO oraz '
    'nie przekazywać ich osobom trzecim bez wyraźnej zgody, z wyjątkiem podmiotów '
    'wspierających działanie platformy (Supabase, Vercel) na podstawie obowiązujących '
    'umów powierzenia przetwarzania danych.', list_style))
story.append(Paragraph(
    '4. Dane zawodnika są usuwane na jego żądanie w terminie do <b>14 dni</b> od zgłoszenia. '
    'Dane Klubu są usuwane w terminie do <b>30 dni</b> od rozwiązania umowy, chyba że '
    'przepisy prawa wymagają dłuższego przechowywania (np. faktury).', list_style))

# ── §5 Dostępność i wsparcie ───────────────────────────────────────────────
story.append(Paragraph('§5 Dostępność i wsparcie', h_style))
story.append(Paragraph(
    '1. Usługodawca dokłada wszelkich starań, aby platforma była dostępna w trybie 24/7. '
    'Dopuszczalne są krótkotrwałe przerwy techniczne na konserwację i aktualizacje, '
    'planowane w godzinach nocnych.', list_style))
story.append(Paragraph(
    '2. Usługodawca świadczy wsparcie techniczne za pośrednictwem:<br/>'
    '— formularza „Zgłoś / Zapytaj" wbudowanego w panel trenera,<br/>'
    '— kanału Discord HoopConnect.', list_style))
story.append(Paragraph(
    '3. Usługodawca zobowiązuje się odpowiedzieć na zgłoszenia w terminie '
    '<b>maksymalnie 3 dni roboczych</b>, a w przypadku awarii blokujących pracę — '
    'niezwłocznie, nie później niż w ciągu 24 godzin.', list_style))

# ── §6 Rozwój ──────────────────────────────────────────────────────────────
story.append(Paragraph('§6 Rozwój i zmiany funkcjonalności', h_style))
story.append(Paragraph(
    '1. Usługodawca zastrzega prawo do rozwijania, zmieniania lub wycofywania '
    'funkcjonalności platformy w celu jej ulepszania.', list_style))
story.append(Paragraph(
    '2. O istotnych zmianach wpływających na sposób korzystania z platformy Usługodawca '
    'poinformuje Klub z wyprzedzeniem co najmniej <b>14 dni</b> za pośrednictwem '
    'aplikacji lub adresu e-mail wskazanego przez Klub.', list_style))

# ── §7 Odpowiedzialność ────────────────────────────────────────────────────
story.append(Paragraph('§7 Ograniczenie odpowiedzialności', h_style))
story.append(Paragraph(
    '1. Odpowiedzialność Usługodawcy z tytułu nienależytego wykonania umowy ograniczona '
    'jest do wysokości wynagrodzenia faktycznie zapłaconego przez Klub w okresie 3 miesięcy '
    'poprzedzających powstanie szkody.', list_style))
story.append(Paragraph(
    '2. Usługodawca nie odpowiada za utratę danych powstałą z winy Klubu lub zawodnika '
    '(np. samodzielne usunięcie konta, wprowadzenie błędnych danych).', list_style))

# ── §8 Końcowe ─────────────────────────────────────────────────────────────
story.append(Paragraph('§8 Postanowienia końcowe', h_style))
story.append(Paragraph(
    '1. Wszelkie zmiany umowy wymagają formy pisemnej (w tym dokumentowej — wiadomość '
    'e-mail z potwierdzeniem) pod rygorem nieważności.', list_style))
story.append(Paragraph(
    '2. W sprawach nieuregulowanych umową zastosowanie mają przepisy Kodeksu cywilnego '
    'oraz ustawy o świadczeniu usług drogą elektroniczną.', list_style))
story.append(Paragraph(
    '3. Spory wynikłe z umowy strony będą rozstrzygać polubownie, a w razie nieosiągnięcia '
    'porozumienia — przed sądem właściwym dla siedziby Usługodawcy.', list_style))
story.append(Paragraph(
    '4. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej '
    'ze stron — lub zawarto elektronicznie z wykorzystaniem podpisu kwalifikowanego, '
    'zaufanego albo poprzez wymianę skanów podpisanych przez upoważnionych przedstawicieli.',
    list_style))

# ── Podpisy ────────────────────────────────────────────────────────────────
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
    ('FONTNAME',   (0,0), (-1,-1), DEFAULT_FONT),
    ('FONTSIZE',   (0,0), (-1,-1), 9),
    ('ALIGN',      (0,0), (-1,-1), 'CENTER'),
    ('TEXTCOLOR',  (0,1), (-1,1),  NAVY),
    ('FONTNAME',   (0,1), (-1,1),  DEFAULT_BOLD),
    ('TEXTCOLOR',  (0,2), (-1,-1), SUB),
    ('BOTTOMPADDING', (0,0), (-1,0), 4),
    ('TOPPADDING',    (0,1), (-1,-1), 1),
]))
story.append(sig_table)

# ── Stopka znacznika ───────────────────────────────────────────────────────
def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont(DEFAULT_FONT, 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(22*mm, 10*mm, 'HoopConnect · Not A Slop Mikołaj Krętowicz · NIP 6662124313')
    canvas.drawRightString(A4[0] - 22*mm, 10*mm, f'Strona {doc.page}')
    canvas.restoreState()

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(f'OK -> {OUT}')
