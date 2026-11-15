import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HexAvatar from '../components/ui/HexAvatar'
import { ARENAS } from '../lib/arenas'

// ── /rank — publiczny ranking (bez logowania), web + mobile ──────────────────
// Metryki osobno: XP (za mecze i grę), wygrane mecze (+ % wygranych), King of the Court.
// Draft Score celowo NIE — prywatna, tygodniowa metryka użytkownika.
// Dane: RPC rank_board / rank_cities (security definer) → tylko publiczne pola; miasto
// jest filtrem, nie kolumną per osoba; profile z flagą anti-cheat pominięte.
//
// Wizualnie: ten sam język co strona hoopconnect.pl (site/): neutralne tło #0E0F12 ze światłem
// z góry, wielki nagłówek Barlow Condensed, matowe przyciski ze ściętym rogiem, żadnych pigułek
// ani szkła. JEDNA kolumna na każdym ekranie: nagłówek → zakładki tablic (przyklejone przy
// przewijaniu) → filtry (okres, miasto) → jedna lista od miejsca 1 (top 3 tylko kolorem medalu).
// Wartość, po której sortujemy, jest zawsze w ostatniej kolumnie; na telefonie kolumny dodatkowe
// zwijają się do podtytułu wiersza. Wydajność: zero backdrop-filter na liście i zero animowanych
// rozmyć w tle; ruch tylko przez opacity/transform. site/src/components/RankBoard.astro to port
// tej tablicy na stronę: zmieniasz wygląd tutaj → popraw też tam.

const METRICS = ['xp', 'matches', 'kotc']
// Lustro rank_min_city_users() w bazie: miasta z mniejszą liczbą graczy nie trafiają do
// filtra. Serwer jest źródłem prawdy (prywatność); tu — natychmiast i defensywnie.
const MIN_CITY_USERS = 10
const MEDAL = ['#FFC940', '#C9D4E3', '#D9925B']
const LIMIT = 100
// Strona informacyjna: za co i ile XP (rozpiska + FAQ).
const HOW_URL = 'https://hoopconnect.pl/ranking'

const CSS = `
.rk{--bg:#0E0F12;--bg2:#15161B;--txt:#EDF2FA;--txt2:#93A4BC;--txt3:#5C6F88;
  --line:rgba(255,255,255,.08);--line2:rgba(255,255,255,.14);--line3:rgba(255,255,255,.22);
  --acc:#2F91D6;--acc-hi:#6FC3FF;--r:3px;--cut:12px;
  --disp:'Barlow Condensed',system-ui,sans-serif;--body:'Barlow',system-ui,sans-serif;
  --ease:cubic-bezier(.2,.7,.2,1);
  /* pełny viewport: wychodzi z 430px "telefonowej" ramki #root apki — to strona WEB */
  position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  color:var(--txt);font-family:var(--body);background:var(--bg);isolation:isolate;-webkit-font-smoothing:antialiased}
.rk *{box-sizing:border-box}
.rk-page{position:relative;min-height:100%;display:flex;flex-direction:column}
.rk-wrap{width:100%;max-width:960px;margin:0 auto;padding-inline:24px}

/* ── tło: światło z góry + plama pod tablicą; statyczne gradienty, przewijają się ze stroną ── */
.rk-bg{position:absolute;z-index:-1;inset:0 0 auto 0;height:1240px;pointer-events:none;
  background:radial-gradient(ellipse 58% 40% at 50% 0%,rgba(111,195,255,.14) 0%,rgba(47,145,214,.05) 46%,transparent 74%),
             radial-gradient(ellipse 66% 42% at 50% 56%,rgba(24,40,74,.55) 0%,rgba(21,33,58,.26) 46%,transparent 76%)}

/* ── pasek górny (jak na stronie): znak + przycisk ── */
.rk-nav .rk-wrap{max-width:1180px}
.rk-nav-in{display:flex;align-items:center;gap:26px;height:68px}
.rk-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--txt);
  font-weight:600;font-size:21px;letter-spacing:.5px;text-transform:uppercase;line-height:1}
.rk-link{margin-left:auto;position:relative;padding-block:6px;font-size:13px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;
  color:var(--txt2);text-decoration:none;white-space:nowrap;transition:color .15s}
.rk-link::after{content:"";position:absolute;left:0;right:0;bottom:-2px;height:2px;background:var(--acc);transform:scaleX(0);transform-origin:left;transition:transform .2s ease}
.rk-link:hover{color:var(--txt)}.rk-link:hover::after{transform:scaleX(1)}

/* Przycisk: mat + ścięty róg z pełnym obrysem (::after = obrys, ::before = wypełnienie wcięte o 1px) */
.rk-btn{--bd:rgba(96,168,224,.5);--fill:#163D65;position:relative;isolation:isolate;z-index:0;display:inline-flex;align-items:center;gap:10px;
  padding:11px 20px;border:0;background:transparent;cursor:pointer;text-decoration:none;white-space:nowrap;color:#EAF3FF;
  font-family:var(--disp);font-weight:700;font-size:14px;line-height:1.2;letter-spacing:1.4px;text-transform:uppercase;transition:transform .1s ease}
.rk-btn::after{content:"";position:absolute;inset:0;z-index:-2;background:var(--bd);
  clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
.rk-btn::before{content:"";position:absolute;inset:1px;z-index:-1;background:var(--fill);transition:background .18s ease;
  clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
.rk-btn:hover{--bd:rgba(120,190,238,.62);--fill:#1B4C7C}
.rk-btn:active{transform:translateY(1px)}
.rk-btn i{font-style:normal;transition:transform .18s ease}.rk-btn:hover i{transform:translateX(4px)}
.rk-btn.lg{--cut:14px;padding:17px 32px;font-size:16px}

/* ── otwarcie ── */
.rk-hero{text-align:center;padding:clamp(22px,4.4vw,52px) 0 clamp(26px,4vw,46px)}
.rk-tag{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--line2);border-radius:var(--r);background:var(--bg2);
  font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--txt2);animation:rk-rise .64s var(--ease) both}
.rk-tag b{width:7px;height:7px;border-radius:50%;background:#37E29A;box-shadow:0 0 0 3px rgba(55,226,154,.18)}
.rk-h1{margin:20px 0 0;overflow:hidden;padding-block:.05em;font-family:var(--disp);font-weight:700;text-transform:uppercase;line-height:.9;letter-spacing:-.01em;
  font-size:clamp(80px,13.5vw,138px);filter:drop-shadow(0 16px 40px rgba(47,145,214,.30))}
.rk-h1 span{display:block;background:linear-gradient(180deg,#FFFFFF 36%,#C3D3EA 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:rk-line .9s .06s var(--ease) both}
.rk-lead{margin:16px auto 0;max-width:46ch;font-size:clamp(16px,1.5vw,19px);line-height:1.6;color:var(--txt2);text-wrap:balance;animation:rk-rise .64s .3s var(--ease) both}

/* ── zakładki tablic: tekst + jedna przesuwana kreska; pasek przykleja się do góry ── */
.rk-sent{height:1px;margin-bottom:-1px}
.rk-strip{position:sticky;top:0;z-index:4;transition:background .25s ease;animation:rk-fade .64s .4s ease both}
.rk-strip.stuck{background:rgba(14,15,18,.9);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}
.rk-strip-in{border-bottom:1px solid var(--line2)}
.rk-tabs{position:relative;display:flex;gap:clamp(20px,3.4vw,38px)}
.rk-tab{appearance:none;border:0;background:none;margin:0;padding:16px 0 15px;cursor:pointer;white-space:nowrap;color:var(--txt3);
  font-family:var(--disp);font-weight:700;font-size:clamp(17px,2.1vw,23px);line-height:1;letter-spacing:.6px;text-transform:uppercase;transition:color .25s}
.rk-tab:hover{color:var(--txt2)}
.rk-tab[aria-selected="true"]{color:var(--txt)}
.rk-tabs::after{content:"";position:absolute;left:0;bottom:-1px;width:100px;height:2px;background:var(--acc-hi);transform-origin:0 50%;
  transform:translateX(calc(var(--tx,0)*1px)) scaleX(calc(var(--tw,0)/100));transition:transform .5s var(--ease)}

/* ── filtry: małe matowe przyciski ze ściętym rogiem (nie pigułki) ── */
.rk-filters{display:flex;align-items:center;gap:10px 22px;flex-wrap:wrap;padding:16px 0 6px;animation:rk-fade .64s .46s ease both}
.rk-fg{display:flex;align-items:center;gap:7px}
.rk-fl{margin-right:4px;font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--txt3)}
.rk-chip{--bd:var(--line2);--fill:#131419;--cut:8px;appearance:none;position:relative;isolation:isolate;z-index:0;flex:none;display:inline-flex;align-items:center;gap:8px;
  margin:0;padding:8px 13px;border:0;background:transparent;cursor:pointer;white-space:nowrap;color:var(--txt2);
  font-family:var(--body);font-size:13px;font-weight:600;line-height:1.25;letter-spacing:.2px;transition:color .2s}
.rk-chip::after{content:"";position:absolute;inset:0;z-index:-2;background:var(--bd);transition:background .2s;
  clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
.rk-chip::before{content:"";position:absolute;inset:1px;z-index:-1;background:var(--fill);transition:background .2s;
  clip-path:polygon(0 0,calc(100% - var(--cut)) 0,100% var(--cut),100% 100%,0 100%)}
.rk-chip:hover{--bd:var(--line3);color:var(--txt)}
.rk-chip.on{--bd:rgba(96,168,224,.6);--fill:#163D65;color:#EAF3FF}
.rk-chip small{font-size:11px;font-weight:600;color:var(--txt3)}
.rk-chip.on small{color:var(--acc-hi)}
.rk-meta{margin-left:auto;display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--txt3);white-space:nowrap}
.rk-mine{appearance:none;border:0;background:none;margin:0;padding:0;cursor:pointer;font:inherit;font-weight:600;color:var(--acc-hi)}
.rk-mine:hover{text-decoration:underline}

/* ── tablica: siatka, linie tylko między wierszami ── */
.rk-board{margin-top:8px}
.rk-board[data-m="xp"]{--cols:52px minmax(0,1fr) minmax(150px,236px) 96px}
.rk-board[data-m="matches"]{--cols:52px minmax(0,1fr) 78px 126px 100px}
.rk-board[data-m="kotc"]{--cols:52px minmax(0,1fr) 78px 148px}
.rk-cols,.rk-row{display:grid;grid-template-columns:var(--cols);column-gap:14px;align-items:center;padding:0 16px 0 4px}
.rk-cols{padding-block:12px 10px;border-bottom:1px solid var(--line)}
.rk-cols span{font-size:11px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:var(--txt3);white-space:nowrap}
.rk-cols span:first-child{text-align:center}
.rk .num{text-align:right;font-variant-numeric:tabular-nums}
.rk-row{position:relative;min-height:64px;border-bottom:1px solid var(--line);transition:background .2s;
  animation:rk-in .5s var(--ease) both;animation-delay:calc(var(--i,0)*30ms)}
.rk-row:hover{background:rgba(255,255,255,.03)}
.rk-n{text-align:center;font-family:var(--disp);font-weight:700;font-size:19px;line-height:1;color:var(--txt3);font-variant-numeric:tabular-nums}
.rk-player{display:flex;align-items:center;gap:13px;min-width:0;padding-block:9px}
.rk-id{min-width:0}
.rk-name{display:flex;align-items:center;gap:9px;min-width:0;font-size:16px;font-weight:600;line-height:1.25}
.rk-name>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-you{flex:none;padding:2px 6px;border:1px solid rgba(111,195,255,.45);border-radius:2px;font-size:10px;font-weight:600;line-height:1.2;letter-spacing:1.2px;
  text-transform:uppercase;color:var(--acc-hi)}
.rk-sub{display:none}
.rk-ex{color:var(--txt2);font-size:14.5px;white-space:nowrap}
.rk-arena{display:flex;align-items:center;gap:10px;min-width:0}
.rk-arena>span{overflow:hidden;text-overflow:ellipsis}
.rk-am{flex:none;width:28px;height:28px;object-fit:contain;color:var(--txt3)}
.rk-val{font-family:var(--disp);font-weight:800;font-size:26px;line-height:1;white-space:nowrap}
/* top 3 = zwykłe wiersze listy: numer i wartość w kolorze medalu + delikatna smuga od lewej */
.rk-row.top{background:linear-gradient(90deg,color-mix(in srgb,var(--medal) 11%,transparent),transparent 46%)}
.rk-row.top .rk-n{color:var(--medal);font-size:27px;text-shadow:0 0 18px color-mix(in srgb,var(--medal) 55%,transparent)}
.rk-row.top .rk-val{color:var(--medal)}
.rk-row.me{background:linear-gradient(90deg,rgba(47,145,214,.24),rgba(47,145,214,.06))}

.rk-state{padding:72px 0;border-bottom:1px solid var(--line);text-align:center;color:var(--txt2);font-size:15px}
.rk-state.err{color:#F3A6A6}
.rk-skel i{display:block;position:relative;height:64px;border-bottom:1px solid var(--line);animation:rk-pulse 1.1s ease-in-out infinite alternate;animation-delay:calc(var(--i,0)*90ms)}
.rk-skel i::before{content:"";position:absolute;left:70px;top:50%;width:36px;height:36px;margin-top:-18px;border-radius:50%;background:rgba(255,255,255,.07)}
.rk-skel i::after{content:"";position:absolute;left:120px;top:50%;width:min(36%,230px);height:12px;margin-top:-6px;border-radius:2px;background:rgba(255,255,255,.07)}

/* ── zamknięcie (dla niezalogowanych) + stopka ── */
.rk-cta{text-align:center;padding:clamp(72px,10vw,132px) 0 clamp(20px,4vw,48px)}
.rk-cta h2{margin:0;font-family:var(--disp);font-weight:700;font-size:clamp(40px,7vw,84px);line-height:.95;text-transform:uppercase;text-wrap:balance}
.rk-cta p{margin:16px auto 28px;max-width:44ch;font-size:clamp(16px,1.5vw,19px);line-height:1.6;color:var(--txt2)}
.rk-foot{margin-top:auto;padding:clamp(40px,6vw,72px) 0 max(28px,env(safe-area-inset-bottom,0px))}
.rk-foot-in{display:flex;flex-wrap:wrap;gap:8px 24px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--txt3)}
.rk-foot a{color:var(--txt2);text-decoration:none}.rk-foot a:hover{color:var(--txt)}
.rk-foot span{margin-right:auto}

.rk-tab:focus-visible,.rk-chip:focus-visible,.rk-btn:focus-visible,.rk-brand:focus-visible,.rk-link:focus-visible,.rk-mine:focus-visible,.rk-foot a:focus-visible{
  outline:2px solid var(--acc-hi);outline-offset:3px}

@keyframes rk-in{from{opacity:0;transform:translateY(10px)}}
@keyframes rk-rise{from{opacity:0;transform:translateY(14px)}}
@keyframes rk-line{from{transform:translateY(108%)}}
@keyframes rk-fade{from{opacity:0}}
@keyframes rk-pulse{from{opacity:.35}to{opacity:1}}
@media (prefers-reduced-motion:reduce){
  .rk-tag,.rk-h1 span,.rk-lead,.rk-strip,.rk-filters,.rk-row,.rk-skel i{animation:none}
  .rk-tabs::after,.rk-btn i,.rk-link::after{transition:none}
}

@media (max-width:720px){
  .rk-wrap{padding-inline:16px}
  .rk-nav-in{height:58px;gap:12px}
  .rk-brand{font-size:19px}.rk-brand img{width:24px;height:24px}
  .rk-link{display:none}
  .rk-nav .rk-btn{margin-left:auto;padding:9px 14px;font-size:13px;letter-spacing:1.1px}.rk-nav .rk-btn i{display:none}
  .rk-h1{font-size:clamp(72px,23vw,128px)}
  /* filtry: jeden rząd przewijany w poziomie, wychodzi do krawędzi ekranu */
  .rk-filters{flex-wrap:nowrap;gap:16px;margin-inline:-16px;padding:14px 16px 4px;overflow-x:auto;scrollbar-width:none}
  .rk-filters::-webkit-scrollbar{display:none}
  .rk-fg{flex:none}
  .rk-meta{display:none}
  .rk-meta.m{display:flex;margin:10px 0 0}
  .rk-board[data-m]{--cols:38px minmax(0,1fr) auto}
  .rk-cols,.rk-row{column-gap:10px;padding:0 6px 0 0}
  .rk-cols .x,.rk-ex{display:none}
  .rk-row{min-height:60px}
  .rk-n{font-size:17px}.rk-row.top .rk-n{font-size:23px}
  .rk-player{gap:11px}
  .rk-name{font-size:15px}
  .rk-sub{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:12px;line-height:1.3;color:var(--txt3)}
  .rk-sub .rk-am{width:16px;height:16px}
  .rk-val{font-size:23px}
  .rk-skel i{height:60px}.rk-skel i::before{left:48px}.rk-skel i::after{left:96px}
}
@media (min-width:721px){.rk-meta.m{display:none}}
`

// Znak areny w wierszu: miniatura grafiki areny (public/arenas/thumb, skrypt scripts/arena-thumbs.mjs).
// Poziom 0 (Rozgrzewka) nie ma grafiki → pusty hex, żeby nazwy stały w jednej linii.
function ArenaMark({ level }) {
  if (!level) return (
    <svg className="rk-am" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.6 20.1 7.3v9.4L12 21.4 3.9 16.7V7.3z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
  return (
    <img className="rk-am" src={`/arenas/thumb/arena-${level}.webp`} alt="" width="28" height="28" loading="lazy" decoding="async"
      onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
  )
}

export default function RankPage() {
  const { t } = useTranslation('rank')
  const { user } = useAuth()
  const me = user?.id || null
  const [metric, setMetric] = useState('xp')
  const [city, setCity]     = useState(null)
  const [period, setPeriod] = useState('all')
  const [cities, setCities] = useState([])
  const [stuck, setStuck]   = useState(false)
  const rkRef = useRef(null), sentRef = useRef(null), tabsRef = useRef(null), meRef = useRef(null)
  // Jeden stan wyniku z kluczem zapytania: "ładowanie" = klucz wyniku ≠ klucz bieżących
  // filtrów (bez setState w ciele efektu — tylko w callbacku RPC; lint react-hooks).
  const qkey = `${metric}|${city ?? ""}|${metric === "matches" ? period : "all"}`
  const [res, setRes]       = useState({ key: null, rows: [], err: false })
  const rows = res.key === qkey ? res.rows : null   // null = ładowanie
  const err  = res.key === qkey && res.err

  useEffect(() => { document.title = `${t('title')} · HoopConnect` }, [t])
  // Pasek przeglądarki na telefonie w kolorze tej strony (apka ma granat); wracamy przy wyjściu.
  useEffect(() => {
    const m = document.querySelector('meta[name="theme-color"]')
    if (!m) return
    const prev = m.getAttribute('content')
    m.setAttribute('content', '#0E0F12')
    return () => { if (prev) m.setAttribute('content', prev) }
  }, [])
  useEffect(() => { supabase.rpc('rank_cities').then(({ data }) => setCities(Array.isArray(data) ? data : [])) }, [])
  useEffect(() => {
    let alive = true
    const [m, c, p] = qkey.split('|')
    supabase.rpc('rank_board', { p_metric: m, p_city: c || null, p_period: p, p_limit: LIMIT })
      .then(({ data, error }) => {
        if (!alive) return
        setRes({ key: qkey, rows: error ? [] : (Array.isArray(data) ? data : []), err: !!error })
      })
    return () => { alive = false }
  }, [qkey])

  // Kreska pod aktywną zakładką: pozycja i szerokość idą do zmiennych CSS (ruch samym transformem).
  // ResizeObserver łapie też doczytanie fontu i zmianę języka (zakładki zmieniają szerokość).
  useLayoutEffect(() => {
    const box = tabsRef.current
    if (!box) return
    const place = () => {
      const el = box.querySelector('[aria-selected="true"]')
      if (!el) return
      box.style.setProperty('--tx', el.offsetLeft)
      box.style.setProperty('--tw', el.offsetWidth)
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(place)
    box.querySelectorAll('button').forEach(b => ro.observe(b))
    return () => ro.disconnect()
  }, [metric])

  // Pasek zakładek dostaje tło dopiero, gdy przyklei się do góry (nad nagłówkiem ma być czysto).
  useEffect(() => {
    const root = rkRef.current, sent = sentRef.current
    if (!root || !sent || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0) + 1)
    }, { root, threshold: 0 })
    io.observe(sent)
    return () => io.disconnect()
  }, [])

  const myIdx = rows && me ? rows.findIndex(r => r.user_id === me) : -1
  const toMine = () => {
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    meRef.current?.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
  }
  const games    = (n) => `${n} ${t('games', { count: n })}`
  const sessions = (n) => `${n} ${t('sessions', { count: n })}`
  const hasRows  = !!rows && !err && rows.length > 0
  const meta = hasRows && (
    <>
      <span>{rows.length >= LIMIT ? t('top', { count: LIMIT }) : t('players', { count: rows.length })}</span>
      {myIdx >= 0 && <button type="button" className="rk-mine" onClick={toMine}>{t('yourPlace', { n: myIdx + 1 })}</button>}
    </>
  )

  return (
    <div className="rk" ref={rkRef}>
      <style>{CSS}</style>
      <div className="rk-page">
        <div className="rk-bg" aria-hidden="true" />

        <header className="rk-nav">
          <div className="rk-wrap rk-nav-in">
            <a href="/" className="rk-brand" aria-label="HoopConnect">
              <img src="/logo-crest.svg" alt="" width="26" height="26" />
              <span>HoopConnect</span>
            </a>
            <a className="rk-link" href={HOW_URL} target="_blank" rel="noopener">{t('how')}</a>
            <a className="rk-btn" href="/">{me ? t('backToApp') : t('ctaBtn')}<i aria-hidden="true">→</i></a>
          </div>
        </header>

        <div className="rk-wrap rk-hero">
          <span className="rk-tag"><b />{t('live')}</span>
          <h1 className="rk-h1"><span>{t('title')}</span></h1>
          <p className="rk-lead">{t('lead')}</p>
        </div>

        <div className="rk-sent" ref={sentRef} aria-hidden="true" />
        <div className={`rk-strip${stuck ? ' stuck' : ''}`}>
          <div className="rk-wrap">
            <div className="rk-strip-in">
              <div className="rk-tabs" role="tablist" aria-label={t('title')} ref={tabsRef}>
                {METRICS.map(m => (
                  <button key={m} type="button" role="tab" aria-selected={metric === m} className="rk-tab" onClick={() => setMetric(m)}>
                    {t(`tabs.${m}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <main className="rk-wrap">
          <div className="rk-filters">
            {metric === 'matches' && (
              <div className="rk-fg" role="group" aria-label={t('periodLabel')}>
                <span className="rk-fl">{t('periodLabel')}</span>
                {['all', '30d'].map(p => (
                  <button key={p} type="button" aria-pressed={period === p} className={`rk-chip${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{t(`period.${p}`)}</button>
                ))}
              </div>
            )}
            <div className="rk-fg" role="group" aria-label={t('cityLabel')}>
              <span className="rk-fl">{t('cityLabel')}</span>
              <button type="button" aria-pressed={city === null} className={`rk-chip${city === null ? ' on' : ''}`} onClick={() => setCity(null)}>{t('allCities')}</button>
              {cities.filter(c => c.n >= MIN_CITY_USERS).map(c => (
                <button key={c.city} type="button" aria-pressed={city === c.city} className={`rk-chip${city === c.city ? ' on' : ''}`} onClick={() => setCity(c.city)}>
                  {c.city} <small>{c.n}</small>
                </button>
              ))}
            </div>
            {meta && <p className="rk-meta">{meta}</p>}
          </div>
          {meta && <p className="rk-meta m">{meta}</p>}

          {/* Tablica */}
          {rows === null && (
            <div className="rk-skel" role="status" aria-label={t('loading')}>
              {Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
            </div>
          )}
          {rows && err && <p className="rk-state err">{t('unavailable')}</p>}
          {rows && !err && rows.length === 0 && <p className="rk-state">{t('empty')}</p>}

          {hasRows && (
            <div className="rk-board" data-m={metric} role="table" aria-label={`${t('title')}: ${t(`tabs.${metric}`)}`}>
              <div className="rk-cols" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">{t('colPlayer')}</span>
                {metric === 'xp' && <>
                  <span role="columnheader" className="x">{t('colArena')}</span>
                  <span role="columnheader" className="num">{t('colXp')}</span>
                </>}
                {metric === 'matches' && <>
                  <span role="columnheader" className="num x">{t('colGames')}</span>
                  <span role="columnheader" className="num x">{t('colPct')}</span>
                  <span role="columnheader" className="num">{t('colWins')}</span>
                </>}
                {metric === 'kotc' && <>
                  <span role="columnheader" className="num x">{t('colSessions')}</span>
                  <span role="columnheader" className="num">{t('colKotcWins')}</span>
                </>}
              </div>
              <div role="rowgroup">
                {rows.map((r, i) => {
                  const mine = r.user_id === me
                  const arena = ARENAS[r.arena]?.name || ''
                  return (
                    <div key={r.user_id} role="row" ref={mine ? meRef : undefined}
                      className={`rk-row${i < 3 ? ' top' : ''}${mine ? ' me' : ''}`}
                      style={{ '--i': Math.min(i, 14), '--medal': i < 3 ? MEDAL[i] : undefined }}>
                      <span role="cell" className="rk-n">{i + 1}</span>
                      <span role="cell" className="rk-player">
                        <HexAvatar name={r.name} variant={r.frame} size={38} noAnim />
                        <span className="rk-id">
                          <span className="rk-name"><span>{r.name}</span>{mine && <span className="rk-you">{t('you')}</span>}</span>
                          {/* telefon: kolumny dodatkowe jako podtytuł wiersza */}
                          <span className="rk-sub">
                            {metric === 'xp' && <><ArenaMark level={r.arena} />{arena}</>}
                            {metric === 'matches' && `${games(r.played ?? 0)} · ${r.pct ?? 0}%`}
                            {metric === 'kotc' && sessions(r.played ?? 0)}
                          </span>
                        </span>
                      </span>
                      {metric === 'xp' && <>
                        <span role="cell" className="rk-ex rk-arena"><ArenaMark level={r.arena} /><span>{arena}</span></span>
                        <span role="cell" className="rk-val num">{r.value}</span>
                      </>}
                      {metric === 'matches' && <>
                        <span role="cell" className="rk-ex num">{r.played ?? 0}</span>
                        <span role="cell" className="rk-ex num">{r.pct ?? 0}%</span>
                        <span role="cell" className="rk-val num">{r.value}</span>
                      </>}
                      {metric === 'kotc' && <>
                        <span role="cell" className="rk-ex num">{r.played ?? 0}</span>
                        <span role="cell" className="rk-val num">{r.value}</span>
                      </>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {!me && rows && (
            <section className="rk-cta">
              <h2>{t('cta')}</h2>
              <p>{t('ctaSub')}</p>
              <a className="rk-btn lg" href="/">{t('ctaBtn')}<i aria-hidden="true">→</i></a>
            </section>
          )}
        </main>

        <footer className="rk-foot">
          <div className="rk-wrap">
            <div className="rk-foot-in">
              <span>© {new Date().getFullYear()} HoopConnect</span>
              <a href={HOW_URL} target="_blank" rel="noopener">{t('how')}</a>
              <a href="https://hoopconnect.pl" target="_blank" rel="noopener">hoopconnect.pl</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
