/**
 * Generuje PDF umowy klubowej w przeglądarce (pdfmake).
 * Treść/styl 1:1 z wersji Python (contracts/generate_umowa.py).
 * Zwraca Blob (do uploadu) i base64 (do wysyłki przez API).
 */
import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

// pdfmake przechowuje fonty w "virtual file system". Różne wersje/bundlery
// exportują vfs w różnym miejscu — sprawdzamy wszystkie znane lokalizacje.
const vfs =
  pdfFonts?.vfs ||
  pdfFonts?.pdfMake?.vfs ||
  pdfFonts?.default?.vfs ||
  pdfFonts?.default?.pdfMake?.vfs ||
  pdfFonts?.default

if (vfs && typeof vfs === 'object') {
  pdfMake.vfs = vfs
  console.log('[generatePdf] vfs loaded, keys count:', Object.keys(vfs).length)
} else {
  console.error('[generatePdf] vfs_fonts not available — PDF generation will fail.', pdfFonts)
}

const NAVY  = '#1E3A5F'
const TEXT  = '#1A2233'
const SUB   = '#4D5C73'
const MUTED = '#8A9AB0'

/**
 * data — dict z formularza (klub_nazwa, klub_adres, ..., data_zawarcia, miasto)
 * logoDataUrl — opcjonalnie data URL logo do wstawienia w nagłówku
 */
export function buildDocDefinition(data, logoDataUrl) {
  const d = data || {}
  const ph = '____________________________________________________'
  const nameField = (v, fallback = ph) => v ? { text: v, bold: true } : { text: fallback }

  const klubNazwaLine = d.klub_nazwa
    ? { text: d.klub_nazwa, bold: true, fontSize: 10 }
    : { text: '_______________________________________________________________', fontSize: 10 }

  return {
    info: {
      title: 'Umowa o świadczenie usług — HoopConnect',
      author: 'Not A Slop Mikołaj Kretowicz',
    },
    pageSize: 'A4',
    pageMargins: [62, 45, 62, 52],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: TEXT, lineHeight: 1.35 },
    styles: {
      title:    { fontSize: 18, bold: true, color: NAVY, alignment: 'center', margin: [0, 12, 0, 4] },
      subtitle: { fontSize: 10, color: MUTED, alignment: 'center', margin: [0, 0, 0, 18] },
      h:        { fontSize: 12, bold: true, color: NAVY, margin: [0, 14, 0, 6] },
      list:     { fontSize: 10, color: TEXT, alignment: 'justify', margin: [14, 0, 0, 4] },
      sub:      { fontSize: 10, color: TEXT, alignment: 'justify', margin: [28, 0, 0, 4] },
      body:     { fontSize: 10, color: TEXT, alignment: 'justify', margin: [0, 0, 0, 6] },
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'HoopConnect · Not A Slop Mikołaj Kretowicz · NIP 6662124313',
          fontSize: 7.5, color: MUTED, margin: [62, 12, 0, 0] },
        { text: `Strona ${currentPage}`,
          fontSize: 7.5, color: MUTED, alignment: 'right', margin: [0, 12, 62, 0] },
      ],
    }),
    content: [
      ...(logoDataUrl ? [{ image: logoDataUrl, width: 62, alignment: 'center', margin: [0, 0, 0, 10] }] : []),

      { text: 'UMOWA O ŚWIADCZENIE USŁUG', style: 'title' },
      {
        text: [
          'platforma ',
          { text: 'HoopConnect', bold: true },
          ' — panel trenera i aplikacja zawodnika',
        ],
        style: 'subtitle',
      },

      {
        text: [
          'zawarta w dniu ',
          { text: d.data_zawarcia || '____ ____________ 2026 r.', bold: true },
          ' w ',
          { text: d.miasto || '________________________', bold: true },
          ' pomiędzy:',
        ],
        style: 'body',
        margin: [0, 0, 0, 10],
      },

      {
        stack: [
          { text: 'Usługodawcą:', bold: true },
          'Mikołaj Kretowicz, prowadzący jednoosobową działalność gospodarczą',
          { text: ['pod firmą ', { text: 'Not A Slop Mikołaj Kretowicz', bold: true }] },
          { text: ['NIP: ', { text: '6662124313', bold: true }] },
          'Adres: ul. Górnicza 3/9, 62-650 Kłodawa',
          { text: ['E-mail: ', { text: 'kontakt@hoopconnect.pl', bold: true }] },
          { text: ['zwanym dalej ', { text: '„Usługodawcą".', bold: true }] },
        ],
        style: 'body',
      },
      { text: 'oraz', style: 'body', margin: [0, 6, 0, 6] },
      {
        stack: [
          { text: 'Klubem:', bold: true },
          klubNazwaLine,
          { text: '(pełna nazwa Klubu / organizacji)', color: SUB, fontSize: 9 },
          { text: '' },
          { text: ['Adres: ', d.klub_adres ? { text: d.klub_adres, bold: true } : ph] },
          { text: ['NIP / REGON: ', d.klub_nip ? { text: d.klub_nip, bold: true } : ph] },
          { text: ['Reprezentowanym przez: ', d.klub_reprezentant ? { text: d.klub_reprezentant, bold: true } : ph] },
          { text: ['E-mail kontaktowy: ', d.klub_email ? { text: d.klub_email, bold: true } : ph] },
          { text: ['zwanym dalej ', { text: '„Klubem".', bold: true }] },
        ],
        style: 'body',
      },

      // ── §1
      { text: '§1 Przedmiot umowy', style: 'h' },
      { text: [
        '1. Usługodawca świadczy na rzecz Klubu usługę polegającą na udostępnieniu dostępu do platformy ',
        { text: 'HoopConnect', bold: true },
        ' — aplikacji webowej dostępnej pod adresami ',
        { text: 'trener.hoopconnect.pl', bold: true },
        ' (panel trenera) oraz ',
        { text: 'hoopconnect.pl', bold: true },
        ' (aplikacja zawodnika).',
      ], style: 'list' },
      { text: '2. Zakres funkcjonalności obejmuje:', style: 'list' },
      { text: [
        'a) zarządzanie składem drużyny;\n',
        'b) planowanie treningów drużynowych w kalendarzu tygodniowym i miesięcznym;\n',
        'c) rejestrację frekwencji zawodników (obecny / spóźniony / nieobecny);\n',
        'd) powiadomienia trenera do drużyny lub wybranych zawodników;\n',
        'e) statystyki treningowe i osiągnięcia zawodników;\n',
        'f) obsługę kategorii wiekowych (U10, U12, U14, U16, U18, Senior) oraz prowadzenie wielu drużyn w ramach jednego konta trenera.',
      ], style: 'sub' },
      { text: '3. Klub uzyskuje dostęp do platformy w trybie świadczenia usługi (SaaS) — bez przeniesienia jakichkolwiek praw autorskich do oprogramowania.', style: 'list' },

      // ── §2
      { text: '§2 Wynagrodzenie', style: 'h' },
      { text: [
        '1. Klub zobowiązuje się płacić Usługodawcy wynagrodzenie miesięczne w wysokości ',
        { text: '10,00 zł (dziesięć złotych) netto za każdego zawodnika', bold: true },
        ' należącego do drużyn Klubu na platformie HoopConnect.',
      ], style: 'list' },
      { text: [
        '2. Liczba zawodników podlegająca rozliczeniu ustalana jest na podstawie ',
        { text: 'stanu składu drużyn z pierwszego dnia danego miesiąca kalendarzowego', bold: true },
        '. Ilu zawodników jest zapisanych do drużyn Klubu w pierwszym dniu miesiąca, taką liczbę pomnaża się przez stawkę 10,00 zł netto — i to jest wynagrodzenie należne za ten miesiąc.',
      ], style: 'list' },
      { text: [
        '3. Zawodnicy dołączający do drużyn w trakcie miesiąca ',
        { text: 'nie wpływają', bold: true },
        ' na wysokość wynagrodzenia w bieżącym miesiącu — zostaną uwzględnieni w rozliczeniu kolejnego miesiąca. Zawodnicy usunięci w trakcie miesiąca pozostają w rozliczeniu tego miesiąca i znikają z rozliczenia od pierwszego dnia kolejnego miesiąca.',
      ], style: 'list' },
      { text: '4. Do wynagrodzenia zostanie doliczony podatek VAT zgodnie z obowiązującymi przepisami (jeśli dotyczy).', style: 'list' },
      { text: [
        '5. Płatność dokonywana jest na podstawie faktury VAT wystawionej przez Usługodawcę w pierwszych 5 dniach roboczych miesiąca następującego po miesiącu rozliczeniowym, z terminem płatności ',
        { text: '14 dni od daty wystawienia', bold: true },
        ', przelewem na rachunek bankowy Usługodawcy wskazany na fakturze.',
      ], style: 'list' },
      { text: '6. W przypadku opóźnienia w płatności przekraczającego 30 dni Usługodawca zastrzega sobie prawo do tymczasowego zawieszenia dostępu do platformy do czasu uregulowania należności.', style: 'list' },

      // ── §3
      { text: '§3 Okres trwania umowy', style: 'h' },
      { text: [
        '1. Umowa zawarta jest na ',
        { text: 'czas nieokreślony', bold: true },
        ', ze skutkiem od dnia jej podpisania.',
      ], style: 'list' },
      { text: [
        '2. Każda ze stron ma prawo wypowiedzieć umowę z zachowaniem ',
        { text: '30-dniowego okresu wypowiedzenia', bold: true },
        ', złożonego w formie pisemnej lub elektronicznej (e-mail z potwierdzeniem odbioru).',
      ], style: 'list' },
      { text: '3. Wypowiedzenie nie powoduje natychmiastowej utraty dostępu — Klub może korzystać z platformy do końca opłaconego okresu rozliczeniowego.', style: 'list' },
      { text: [
        '4. ',
        { text: 'Pierwszy miesiąc świadczenia usługi jest bezpłatnym okresem testowym.', bold: true },
        ' W tym czasie Klub może wypowiedzieć umowę ze skutkiem natychmiastowym bez ponoszenia jakichkolwiek kosztów. Pierwsza faktura zostanie wystawiona za drugi pełny miesiąc świadczenia usługi.',
      ], style: 'list' },

      // ── §4
      { text: '§4 Ochrona danych osobowych (RODO)', style: 'h' },
      { text: '1. Usługodawca przetwarza dane osobowe trenerów i zawodników (imię, nazwisko, adres e-mail, dane treningowe, frekwencja) wyłącznie w zakresie niezbędnym do świadczenia Usługi i tylko na czas jej trwania.', style: 'list' },
      { text: '2. Klub oświadcza, że posiada zgody zawodników (lub ich opiekunów prawnych w przypadku osób niepełnoletnich) na przetwarzanie danych w zakresie wymaganym dla działania platformy oraz że poinformuje zawodników o korzystaniu z platformy HoopConnect.', style: 'list' },
      { text: '3. Usługodawca zobowiązuje się zabezpieczyć dane zgodnie z wymaganiami RODO oraz nie przekazywać ich osobom trzecim bez wyraźnej zgody, z wyjątkiem podmiotów wspierających działanie platformy (Supabase, Vercel) na podstawie obowiązujących umów powierzenia przetwarzania danych.', style: 'list' },
      { text: [
        '4. Dane zawodnika są usuwane na jego żądanie w terminie do ',
        { text: '14 dni', bold: true },
        ' od zgłoszenia. Dane Klubu są usuwane w terminie do ',
        { text: '30 dni', bold: true },
        ' od rozwiązania umowy, chyba że przepisy prawa wymagają dłuższego przechowywania (np. faktury).',
      ], style: 'list' },

      // ── §5
      { text: '§5 Dostępność i wsparcie', style: 'h' },
      { text: '1. Usługodawca dokłada wszelkich starań, aby platforma była dostępna w trybie 24/7. Dopuszczalne są krótkotrwałe przerwy techniczne na konserwację i aktualizacje, planowane w godzinach nocnych.', style: 'list' },
      { text: [
        '2. Usługodawca świadczy wsparcie techniczne za pośrednictwem:\n',
        '— formularza „Zgłoś / Zapytaj" wbudowanego w panel trenera,\n',
        '— kanału Discord HoopConnect.',
      ], style: 'list' },
      { text: [
        '3. Usługodawca zobowiązuje się odpowiedzieć na zgłoszenia w terminie ',
        { text: 'maksymalnie 3 dni roboczych', bold: true },
        ', a w przypadku awarii blokujących pracę — niezwłocznie, nie później niż w ciągu 24 godzin.',
      ], style: 'list' },

      // ── §6
      { text: '§6 Rozwój i zmiany funkcjonalności', style: 'h' },
      { text: '1. Usługodawca zastrzega prawo do rozwijania, zmieniania lub wycofywania funkcjonalności platformy w celu jej ulepszania.', style: 'list' },
      { text: [
        '2. O istotnych zmianach wpływających na sposób korzystania z platformy Usługodawca poinformuje Klub z wyprzedzeniem co najmniej ',
        { text: '14 dni', bold: true },
        ' za pośrednictwem aplikacji lub adresu e-mail wskazanego przez Klub.',
      ], style: 'list' },

      // ── §7
      { text: '§7 Ograniczenie odpowiedzialności', style: 'h' },
      { text: '1. Odpowiedzialność Usługodawcy z tytułu nienależytego wykonania umowy ograniczona jest do wysokości wynagrodzenia faktycznie zapłaconego przez Klub w okresie 3 miesięcy poprzedzających powstanie szkody.', style: 'list' },
      { text: '2. Usługodawca nie odpowiada za utratę danych powstałą z winy Klubu lub zawodnika (np. samodzielne usunięcie konta, wprowadzenie błędnych danych).', style: 'list' },

      // ── §8
      { text: '§8 Postanowienia końcowe', style: 'h' },
      { text: '1. Wszelkie zmiany umowy wymagają formy pisemnej (w tym dokumentowej — wiadomość e-mail z potwierdzeniem) pod rygorem nieważności.', style: 'list' },
      { text: '2. W sprawach nieuregulowanych umową zastosowanie mają przepisy Kodeksu cywilnego oraz ustawy o świadczeniu usług drogą elektroniczną.', style: 'list' },
      { text: '3. Spory wynikłe z umowy strony będą rozstrzygać polubownie, a w razie nieosiągnięcia porozumienia — przed sądem właściwym dla siedziby Usługodawcy.', style: 'list' },
      { text: '4. Umowę sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze stron — lub zawarto elektronicznie z wykorzystaniem podpisu kwalifikowanego, zaufanego albo poprzez wymianę skanów podpisanych przez upoważnionych przedstawicieli.', style: 'list' },

      // Podpisy
      { text: '', margin: [0, 30, 0, 0] },
      {
        columns: [
          { stack: [
            { text: '_______________________________', alignment: 'center' },
            { text: 'Usługodawca', alignment: 'center', bold: true, color: NAVY, margin: [0, 4, 0, 0] },
            { text: 'Mikołaj Kretowicz', alignment: 'center', color: SUB, fontSize: 9 },
            { text: 'Not A Slop Mikołaj Kretowicz', alignment: 'center', color: SUB, fontSize: 9 },
            { text: 'data, podpis', alignment: 'center', color: SUB, fontSize: 9 },
          ]},
          { stack: [
            { text: '_______________________________', alignment: 'center' },
            { text: 'Klub', alignment: 'center', bold: true, color: NAVY, margin: [0, 4, 0, 0] },
            { text: '(imię i nazwisko, funkcja)', alignment: 'center', color: SUB, fontSize: 9 },
            { text: '', margin: [0, 0, 0, 12] },
            { text: 'data, podpis', alignment: 'center', color: SUB, fontSize: 9 },
          ]},
        ],
      },
    ],
  }
}


/**
 * Pobiera logo /hoop.svg → konwertuje do data URL (PNG via canvas).
 * Zwraca null jeśli się nie udało.
 */
async function fetchLogoDataUrl() {
  try {
    const res = await fetch('/hoop.svg')
    const svgText = await res.text()
    const img = new Image()
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    await new Promise((resolve, reject) => {
      img.onload = resolve; img.onerror = reject; img.src = url
    })
    const size = 256
    const canvas = document.createElement('canvas')
    canvas.width = size; canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, size, size)
    URL.revokeObjectURL(url)
    return canvas.toDataURL('image/png')
  } catch (e) {
    console.warn('[generatePdf] could not load logo:', e)
    return null
  }
}

/** Główna funkcja — zwraca { blob, base64 }. */
export async function generateContractPdf(data) {
  console.log('[generatePdf] start')
  if (!pdfMake.vfs) {
    throw new Error('pdfmake fonts (VFS) niezaładowane — sprawdź konsolę')
  }
  const logo = await fetchLogoDataUrl()
  console.log('[generatePdf] logo:', logo ? 'loaded' : 'skipped')

  const docDef = buildDocDefinition(data, logo)
  console.log('[generatePdf] doc definition built, generating blob...')

  // 30-sekundowy timeout żeby UI nie wisiał na zawsze przy uszkodzonym VFS.
  const blob = await Promise.race([
    new Promise((resolve, reject) => {
      try {
        pdfMake.createPdf(docDef).getBlob(b => {
          if (!b) return reject(new Error('PDF generation returned empty'))
          resolve(b)
        })
      } catch (err) {
        reject(err)
      }
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout — generowanie PDF zajęło >30s. Sprawdź konsolę.')), 30000)
    ),
  ])
  console.log('[generatePdf] blob size:', blob.size, 'bytes')

  const base64 = await blobToBase64(blob)
  console.log('[generatePdf] base64 length:', base64.length)
  return { blob, base64 }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result || ''
      const idx = result.indexOf(',')
      resolve(idx >= 0 ? result.slice(idx + 1) : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
