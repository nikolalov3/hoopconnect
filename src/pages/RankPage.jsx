import { useEffect, useState } from 'react'
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
// Layout: JEDEN markup, CSS decyduje — desktop (≥ 900px): nagłówek z tabami metryk,
// sidebar (okres, miasta) + podium w rzędzie + tabela z kolumnami; mobile: kolumna,
// filtry jako chipy (scroll poziomy), tabela zwija kolumny dodatkowe do podtytułu wiersza.
// Wizualnie: "liquid glass" — jedno tło z pływającymi orbami światła, a każda powierzchnia
// (.rk-glass) to półprzezroczyste szkło: backdrop blur + saturacja, 1px krawędź, refleks
// na górnej krawędzi (::after) i ukośny połysk (::before). Bez transformów na kartach z
// backdrop-filter (drogie), animacje wejścia tylko opacity/translate na wierszach.

const METRICS = ['xp', 'matches', 'kotc']
// Lustro rank_min_city_users() w bazie: miasta z mniejszą liczbą graczy nie trafiają do
// filtra. Serwer jest źródłem prawdy (prywatność); tu — natychmiast i defensywnie.
const MIN_CITY_USERS = 10
const MEDAL = ['#FFC940', '#C9D4E3', '#D9925B']

const CSS = `
.rk{--navy:#050A14;--blue:#5BB8F5;--txt:#EEF4FF;--muted:rgba(238,244,255,.62);--dim:rgba(238,244,255,.36);
  --line:rgba(255,255,255,.12);--hi:rgba(255,255,255,.30);
  --glass:linear-gradient(135deg,rgba(255,255,255,.11) 0%,rgba(255,255,255,.045) 45%,rgba(255,255,255,.07) 100%);
  --shadow:0 24px 60px -28px rgba(0,0,0,.75);
  --disp:'Barlow Condensed',sans-serif;
  /* pełny viewport: wychodzi z 430px "telefonowej" ramki #root apki — to strona WEB */
  position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  color:var(--txt);font-family:'Barlow',sans-serif;background:var(--navy);isolation:isolate}
.rk *{box-sizing:border-box}

/* ── tło: głębia + pływające orby światła pod szkłem ── */
.rk-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;
  background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(91,184,245,.20),transparent 60%),
             linear-gradient(170deg,#0F1D33 0%,#0A1426 45%,var(--navy) 100%)}
.rk-orb{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;will-change:transform}
.rk-orb.a{width:52vmax;height:52vmax;left:-14vmax;top:-18vmax;
  background:radial-gradient(circle,rgba(91,184,245,.55),rgba(91,184,245,0) 70%);animation:rk-float 26s ease-in-out infinite alternate}
.rk-orb.b{width:44vmax;height:44vmax;right:-12vmax;top:22vh;
  background:radial-gradient(circle,rgba(84,110,255,.45),rgba(84,110,255,0) 70%);animation:rk-float 34s ease-in-out infinite alternate-reverse}
.rk-orb.c{width:36vmax;height:36vmax;left:30vw;bottom:-18vmax;
  background:radial-gradient(circle,rgba(255,201,64,.22),rgba(255,201,64,0) 70%);animation:rk-float 40s ease-in-out infinite alternate}
@keyframes rk-float{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(6vw,4vh,0) scale(1.08)}}

/* ── szkło ── */
.rk-glass{position:relative;background:var(--glass);border:1px solid var(--line);border-radius:22px;box-shadow:var(--shadow);
  -webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%)}
.rk-glass::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:linear-gradient(115deg,rgba(255,255,255,.22) 0%,rgba(255,255,255,0) 28%,rgba(255,255,255,0) 70%,rgba(255,255,255,.08) 100%);
  -webkit-mask:linear-gradient(#000,transparent 60%);mask:linear-gradient(#000,transparent 60%)}
.rk-glass::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 0 var(--hi),inset 0 -1px 0 rgba(255,255,255,.04)}

.rk-wrap{max-width:1160px;margin:0 auto;padding:max(24px,env(safe-area-inset-top,0px)) 24px 72px}
.rk-top{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:34px}
.rk-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--txt)}
.rk-brand img{filter:drop-shadow(0 6px 16px rgba(91,184,245,.45))}
.rk-brand span{font-family:var(--disp);font-size:19px;font-weight:900;letter-spacing:.6px;text-transform:uppercase;line-height:1}
.rk-brand span i{font-style:normal;color:var(--blue)}
.rk-meta{display:none}
.rk-pill{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);padding:8px 13px;border-radius:999px;display:flex;align-items:center;gap:8px}
.rk-pill b{width:7px;height:7px;border-radius:50%;background:#5BF5A6;box-shadow:0 0 12px #5BF5A6}

.rk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.rk-h1{font-family:var(--disp);text-transform:uppercase;font-weight:900;letter-spacing:.5px;font-size:64px;line-height:.95;margin:0;text-wrap:balance;
  background:linear-gradient(180deg,#FFFFFF 15%,rgba(200,236,255,.72));-webkit-background-clip:text;background-clip:text;color:transparent}

.rk-tabs{display:flex;gap:4px;padding:5px;border-radius:999px}
.rk-tab{position:relative;padding:11px 20px;border-radius:999px;border:0;background:transparent;color:var(--muted);
  font:inherit;font-size:13.5px;font-weight:800;letter-spacing:.3px;cursor:pointer;white-space:nowrap;transition:color .25s,background .25s,box-shadow .25s}
.rk-tab:hover{color:var(--txt)}
.rk-tab.on{color:#fff;background:linear-gradient(135deg,rgba(91,184,245,.58),rgba(46,144,212,.34));
  box-shadow:0 10px 26px -10px rgba(91,184,245,.85),inset 0 1px 0 rgba(255,255,255,.48),inset 0 -1px 0 rgba(0,0,0,.18)}
.rk-tab:focus-visible,.rk-opt:focus-visible,.rk-cta:focus-visible,.rk-brand:focus-visible{outline:2px solid var(--blue);outline-offset:2px}

.rk-grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:28px;margin-top:32px;align-items:start}
.rk-side{position:sticky;top:20px;display:flex;flex-direction:column;gap:14px}
.rk-panel{padding:16px}
.rk-gt{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);margin:0 0 10px 4px}
.rk-opts{display:flex;flex-direction:column;gap:6px}
.rk-opt{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;
  padding:10px 12px;border-radius:13px;border:1px solid transparent;background:rgba(255,255,255,.04);color:var(--muted);
  font:inherit;font-size:13.5px;font-weight:700;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.rk-opt:hover{background:rgba(255,255,255,.08);color:var(--txt)}
.rk-opt.on{background:linear-gradient(135deg,rgba(91,184,245,.30),rgba(91,184,245,.10));border-color:rgba(91,184,245,.45);color:#fff;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.28)}
.rk-opt small{color:var(--dim);font-size:11px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.06)}
.rk-opt.on small{color:var(--txt);background:rgba(91,184,245,.28)}

.rk-meta{color:var(--dim);font-size:12.5px;margin:0 0 12px 4px}
.rk-podium{display:grid;grid-template-columns:1fr 1.18fr 1fr;gap:14px;align-items:end;margin-bottom:16px}
.rk-card{--medal:#C9D4E3;padding:20px 14px 18px;text-align:center;border-radius:24px;animation:rk-in .6s cubic-bezier(.2,.8,.2,1) both;
  box-shadow:var(--shadow),0 0 0 1px color-mix(in srgb,var(--medal) 30%,transparent),0 34px 70px -40px color-mix(in srgb,var(--medal) 75%,transparent)}
.rk-card.p1{animation-delay:.06s}.rk-card.p2{animation-delay:.12s}
.rk-card.p0{padding-top:30px;padding-bottom:24px;
  background:linear-gradient(160deg,color-mix(in srgb,var(--medal) 18%,transparent),rgba(255,255,255,.05) 45%,rgba(255,255,255,.07))}
.rk-place{font-family:var(--disp);font-weight:900;font-size:28px;line-height:1;color:var(--medal);text-shadow:0 0 18px color-mix(in srgb,var(--medal) 55%,transparent)}
.rk-card.p0 .rk-place{font-size:40px}
.rk-hex{display:flex;justify-content:center;margin:12px 0 10px;filter:drop-shadow(0 10px 22px rgba(0,0,0,.45))}
.rk-name{font-size:14.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-val{font-family:var(--disp);font-weight:900;font-size:22px;margin-top:6px;font-variant-numeric:tabular-nums;color:var(--medal)}
.rk-card.p0 .rk-val{font-size:30px}
.rk-small{font-size:11.5px;color:var(--muted);margin-top:4px}

.rk-board{padding:8px}
.rk-table{width:100%;border-collapse:separate;border-spacing:0 4px}
.rk-table th{text-align:left;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:var(--muted);padding:10px 14px 6px}
.rk-table th.num,.rk-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.rk-table tbody tr{animation:rk-in .5s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i,0)*28ms)}
.rk-table td{padding:10px 14px;background:rgba(255,255,255,.035);vertical-align:middle;transition:background .2s}
.rk-table tr:hover td{background:rgba(255,255,255,.075)}
.rk-table td:first-child{border-radius:14px 0 0 14px;width:60px;font-family:var(--disp);font-weight:900;font-size:18px;color:var(--dim);text-align:center}
.rk-table td:last-child{border-radius:0 14px 14px 0}
.rk-table tr.me td{background:linear-gradient(90deg,rgba(91,184,245,.22),rgba(91,184,245,.08));box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.rk-player{display:flex;align-items:center;gap:12px;min-width:0}
.rk-player .n{font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-player .you{color:var(--blue)}
.rk-player .m{display:none;font-size:11.5px;color:var(--muted);margin-top:2px}
.rk-table td.val{font-family:var(--disp);font-weight:900;font-size:20px;white-space:nowrap}
.rk-table td.ex{color:var(--muted);font-size:14px;white-space:nowrap}
.rk-state{color:var(--muted);font-size:14px;text-align:center;padding:64px 0}
.rk-state.err{color:#F3A6A6}
.rk-skel{display:flex;flex-direction:column;gap:6px;padding:8px}
.rk-skel i{display:block;height:58px;border-radius:14px;
  background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.10),rgba(255,255,255,.04));background-size:200% 100%;animation:rk-sh 1.4s linear infinite}

.rk-cta{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:24px;padding:20px 22px;border-radius:22px;text-decoration:none;color:var(--txt);
  background:linear-gradient(135deg,rgba(91,184,245,.42),rgba(46,144,212,.22) 60%,rgba(255,255,255,.06))}
.rk-cta b{display:block;font-family:var(--disp);text-transform:uppercase;font-weight:900;font-size:20px;letter-spacing:.5px}
.rk-cta span{display:block;font-size:13px;color:var(--muted);margin-top:3px}
.rk-cta em{font-style:normal;flex:none;padding:12px 18px;border-radius:999px;background:#fff;color:#0B1B33;font-weight:800;font-size:13px;
  box-shadow:0 10px 30px -12px rgba(255,255,255,.7)}

@keyframes rk-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes rk-sh{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.rk-orb,.rk-table tbody tr,.rk-card,.rk-skel i{animation:none}}

@media (max-width:900px){
  .rk-wrap{padding-left:14px;padding-right:14px;padding-bottom:56px}
  .rk-top{margin-bottom:22px}
  .rk-pill{display:none}.rk-meta{display:block}
  .rk-h1{font-size:44px}
  .rk-head{align-items:stretch;gap:14px}
  .rk-tabs{width:100%}.rk-tab{flex:1;padding:10px 6px;font-size:12.5px}
  .rk-grid{grid-template-columns:1fr;gap:12px;margin-top:20px}
  .rk-side{position:static;gap:10px}
  .rk-panel{padding:10px 12px}
  .rk-opts{flex-direction:row;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
  .rk-opts::-webkit-scrollbar{display:none}
  .rk-opt{width:auto;flex:none;padding:7px 12px;border-radius:999px;font-size:12px}
  .rk-podium{gap:8px}.rk-card{padding:12px 8px;border-radius:18px}.rk-card.p0{padding:18px 10px 14px}
  .rk-val{font-size:18px}.rk-card.p0 .rk-val{font-size:24px}
  .rk-board{padding:4px}
  .rk-table th{display:none}
  .rk-table td.ex,.rk-hide-m{display:none}
  .rk-player .m{display:block}
  .rk-table td:first-child{width:44px;padding-left:8px;padding-right:6px}
  .rk-table td{padding:9px 10px}
  .rk-cta{flex-direction:column;align-items:stretch;text-align:center}
}
`

export default function RankPage() {
  const { t } = useTranslation('rank')
  const { user } = useAuth()
  const me = user?.id || null
  const [metric, setMetric] = useState('xp')
  const [city, setCity]     = useState(null)
  const [period, setPeriod] = useState('all')
  const [cities, setCities] = useState([])
  // Jeden stan wyniku z kluczem zapytania: "ładowanie" = klucz wyniku ≠ klucz bieżących
  // filtrów (bez setState w ciele efektu — tylko w callbacku RPC; lint react-hooks).
  const qkey = `${metric}|${city ?? ""}|${metric === "matches" ? period : "all"}`
  const [res, setRes]       = useState({ key: null, rows: [], err: false })
  const rows = res.key === qkey ? res.rows : null   // null = ładowanie
  const err  = res.key === qkey && res.err

  useEffect(() => { document.title = `${t('title')} · HoopConnect` }, [t])
  useEffect(() => { supabase.rpc('rank_cities').then(({ data }) => setCities(Array.isArray(data) ? data : [])) }, [])
  useEffect(() => {
    let alive = true
    const [m, c, p] = qkey.split('|')
    supabase.rpc('rank_board', { p_metric: m, p_city: c || null, p_period: p, p_limit: 100 })
      .then(({ data, error }) => {
        if (!alive) return
        setRes({ key: qkey, rows: error ? [] : (Array.isArray(data) ? data : []), err: !!error })
      })
    return () => { alive = false }
  }, [qkey])

  const value = (r) => metric === 'xp' ? `${r.value} XP` : metric === 'kotc' ? `${r.value} 🏆` : `${r.value} ${t('wins')}`
  const mobileSub = (r) => metric === 'matches' ? `${r.played} ${t('games')} · ${r.pct ?? 0}%`
    : metric === 'kotc' ? `${r.played ?? 0} ${t('sessions')}` : (ARENAS[r.arena]?.name || '')
  const podium = rows ? rows.slice(0, 3) : []
  const rest   = rows ? rows.slice(3) : []

  return (
    <div className="rk">
      <style>{CSS}</style>
      <div className="rk-bg" aria-hidden="true"><span className="rk-orb a" /><span className="rk-orb b" /><span className="rk-orb c" /></div>
      <div className="rk-wrap">
        <div className="rk-top">
          <a href="/" className="rk-brand" aria-label="HoopConnect">
            <img src="/logo-crest.svg" alt="" width="30" height="30" />
            <span>Hoop<i>Connect</i></span>
          </a>
          {rows && !err && rows.length > 0 && <div className="rk-pill rk-glass"><b />{rows.length} {t('players')}</div>}
        </div>

        <div className="rk-head">
          <div>
            <h1 className="rk-h1">{t('title')}</h1>
          </div>
          <div className="rk-tabs rk-glass" role="tablist">
            {METRICS.map(m => (
              <button key={m} role="tab" aria-selected={metric === m} className={`rk-tab${metric === m ? ' on' : ''}`} onClick={() => setMetric(m)}>
                {t(`tabs.${m}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="rk-grid">
          {/* Filtry — sidebar na desktopie, chipy (scroll poziomy) na telefonie */}
          <aside className="rk-side">
            {metric === 'matches' && (
              <div className="rk-panel rk-glass">
                <p className="rk-gt">{t('periodLabel')}</p>
                <div className="rk-opts">
                  {['all', '30d'].map(p => (
                    <button key={p} className={`rk-opt${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{t(`period.${p}`)}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="rk-panel rk-glass">
              <p className="rk-gt">{t('cityLabel')}</p>
              <div className="rk-opts">
                <button className={`rk-opt${city === null ? ' on' : ''}`} onClick={() => setCity(null)}>{t('allCities')}</button>
                {cities.filter(c => c.n >= MIN_CITY_USERS).map(c => (
                  <button key={c.city} className={`rk-opt${city === c.city ? ' on' : ''}`} onClick={() => setCity(c.city)}>
                    {c.city} <small>{c.n}</small>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Tablica */}
          <main>
            {rows && !err && rows.length > 0 && <p className="rk-meta">{rows.length} {t('players')}</p>}
            {rows === null && (
              <div className="rk-skel rk-glass" aria-label={t('loading')}><i /><i /><i /><i /><i /><i /></div>
            )}
            {rows && err && <p className="rk-state err">{t('unavailable')}</p>}
            {rows && !err && rows.length === 0 && <p className="rk-state">{t('empty')}</p>}

            {podium.length > 0 && (
              <div className="rk-podium">
                {[podium[1], podium[0], podium[2]].map((r, i) => {
                  if (!r) return <div key={`e${i}`} />
                  const place = i === 1 ? 0 : i === 0 ? 1 : 2
                  const mine = r.user_id === me
                  return (
                    <div key={r.user_id} className={`rk-card rk-glass p${place}`} style={{ '--medal': mine ? '#5BB8F5' : MEDAL[place] }}>
                      <div className="rk-place">{place + 1}</div>
                      <div className="rk-hex"><HexAvatar name={r.name} variant={r.frame} size={place === 0 ? 84 : 64} noAnim /></div>
                      <div className="rk-name">{r.name}{mine ? ` · ${t('you')}` : ''}</div>
                      <div className="rk-val">{value(r)}</div>
                      <div className="rk-small">{mobileSub(r)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {rest.length > 0 && (
              <div className="rk-board rk-glass">
                <table className="rk-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('colPlayer')}</th>
                      {metric === 'xp'      && <><th>{t('colArena')}</th><th className="num">{t('colXp')}</th></>}
                      {metric === 'matches' && <><th className="num">{t('colWins')}</th><th className="num">{t('colGames')}</th><th className="num">{t('colPct')}</th></>}
                      {metric === 'kotc'    && <><th className="num">{t('colKotcWins')}</th><th className="num">{t('colSessions')}</th></>}
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((r, i) => {
                      const mine = r.user_id === me
                      return (
                        <tr key={r.user_id} className={mine ? 'me' : ''} style={{ '--i': i }}>
                          <td>{i + 4}</td>
                          <td>
                            <div className="rk-player">
                              <HexAvatar name={r.name} variant={r.frame} size={38} noAnim />
                              <div style={{ minWidth: 0 }}>
                                <div className="n">{r.name}{mine ? <span className="you"> · {t('you')}</span> : null}</div>
                                <div className="m">{mobileSub(r)}</div>
                              </div>
                            </div>
                          </td>
                          {metric === 'xp' && <>
                            <td className="ex">{ARENAS[r.arena]?.name || ''}</td>
                            <td className="val num">{r.value}</td>
                          </>}
                          {metric === 'matches' && <>
                            <td className="val num">{r.value}</td>
                            <td className="ex num">{r.played}</td>
                            <td className="ex num rk-hide-m">{r.pct ?? 0}%</td>
                          </>}
                          {metric === 'kotc' && <>
                            <td className="val num">{r.value}</td>
                            <td className="ex num">{r.played ?? 0}</td>
                          </>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!me && rows && (
              <a href="/" className="rk-cta rk-glass">
                <div><b>{t('cta')}</b><span>{t('ctaSub')}</span></div>
                <em>{t('ctaBtn')}</em>
              </a>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
