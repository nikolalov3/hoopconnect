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
// filtry jako chipy, tabela zwija kolumny dodatkowe do podtytułu wiersza.

const METRICS = ['xp', 'matches', 'kotc']
// Lustro rank_min_city_users() w bazie: miasta z mniejszą liczbą graczy nie trafiają do
// filtra. Serwer jest źródłem prawdy (prywatność); tu — natychmiast i defensywnie.
const MIN_CITY_USERS = 10
const MEDAL = ['#FFC940', '#C9D4E3', '#D9925B']

const CSS = `
.rk{--navy:#060B16;--blue:#5BB8F5;--txt:#EEF4FF;--muted:rgba(238,244,255,.58);--dim:rgba(238,244,255,.34);
  --line:rgba(255,255,255,.10);--card:rgba(255,255,255,.05);--disp:'Barlow Condensed',sans-serif;
  /* pełny viewport: wychodzi z 430px "telefonowej" ramki #root apki — to strona WEB */
  position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;
  color:var(--txt);font-family:'Barlow',sans-serif;
  background:radial-gradient(ellipse 90% 55% at 50% -10%,rgba(91,184,245,.16) 0%,transparent 60%),
             radial-gradient(ellipse 60% 40% at 100% 100%,rgba(34,86,150,.14) 0%,transparent 55%),
             linear-gradient(170deg,#14243E 0%,#0B172A 52%,var(--navy) 100%)}
.rk *{box-sizing:border-box}
.rk-wrap{max-width:1120px;margin:0 auto;padding:max(28px,env(safe-area-inset-top,0px)) 24px 64px}
.rk-brand{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.rk-brand span{font-size:11px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;color:var(--muted)}
.rk-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;flex-wrap:wrap}
.rk-h1{font-family:var(--disp);text-transform:uppercase;font-weight:900;letter-spacing:.5px;font-size:52px;line-height:1;margin:0}
.rk-sub{color:var(--muted);font-size:14px;margin:8px 0 0;line-height:1.45;max-width:56ch}
.rk-tabs{display:flex;gap:6px;background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:999px;padding:4px}
.rk-tab{padding:9px 18px;border-radius:999px;border:1px solid transparent;background:transparent;color:var(--muted);
  font:inherit;font-size:13px;font-weight:800;letter-spacing:.3px;cursor:pointer;white-space:nowrap}
.rk-tab.on{background:rgba(91,184,245,.16);border-color:rgba(91,184,245,.6);color:var(--blue)}
.rk-grid{display:grid;grid-template-columns:250px minmax(0,1fr);gap:28px;margin-top:28px;align-items:start}
.rk-side{position:sticky;top:24px;display:flex;flex-direction:column;gap:20px}
.rk-gt{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);margin:0 0 8px 2px}
.rk-opts{display:flex;flex-direction:column;gap:6px}
.rk-opt{display:flex;justify-content:space-between;align-items:center;gap:10px;width:100%;text-align:left;
  padding:9px 12px;border-radius:11px;border:1px solid var(--line);background:var(--card);color:var(--muted);
  font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.rk-opt.on{background:rgba(91,184,245,.14);border-color:rgba(91,184,245,.55);color:var(--txt)}
.rk-opt small{color:var(--dim);font-size:11px;font-weight:700}
.rk-meta{color:var(--dim);font-size:12px;margin:0 0 12px 2px}
.rk-podium{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:12px;align-items:end;margin-bottom:22px}
.rk-card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 14px 16px;text-align:center}
.rk-card.p0{padding-top:26px;padding-bottom:22px}
.rk-place{font-family:var(--disp);font-weight:900;font-size:26px;line-height:1}
.rk-card.p0 .rk-place{font-size:36px}
.rk-hex{display:flex;justify-content:center;margin:10px 0 8px}
.rk-name{font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-val{font-family:var(--disp);font-weight:900;font-size:20px;margin-top:6px;font-variant-numeric:tabular-nums}
.rk-card.p0 .rk-val{font-size:26px}
.rk-small{font-size:11.5px;color:var(--muted);margin-top:3px}
.rk-table{width:100%;border-collapse:separate;border-spacing:0 6px}
.rk-table th{text-align:left;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted);padding:0 14px 2px}
.rk-table th.num,.rk-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.rk-table td{padding:10px 14px;background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);vertical-align:middle}
.rk-table td:first-child{border-left:1px solid var(--line);border-radius:12px 0 0 12px;width:56px;font-family:var(--disp);font-weight:900;font-size:18px;color:var(--dim);text-align:center}
.rk-table td:last-child{border-right:1px solid var(--line);border-radius:0 12px 12px 0}
.rk-table tr.me td{background:rgba(91,184,245,.09);border-color:rgba(91,184,245,.5)}
.rk-player{display:flex;align-items:center;gap:12px;min-width:0}
.rk-player .n{font-size:15px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rk-player .you{color:var(--blue)}
.rk-player .m{display:none;font-size:11.5px;color:var(--muted);margin-top:2px}
.rk-table td.val{font-family:var(--disp);font-weight:900;font-size:19px;white-space:nowrap}
.rk-table td.ex{color:var(--muted);font-size:14px;white-space:nowrap}
.rk-state{color:var(--muted);font-size:14px;text-align:center;padding:56px 0}
.rk-state.err{color:#F3A6A6}
.rk-cta{display:block;margin-top:28px;padding:18px 20px;border-radius:16px;text-decoration:none;text-align:center;
  background:linear-gradient(120deg,var(--blue),#2272C3);color:var(--navy)}
.rk-cta b{display:block;font-family:var(--disp);text-transform:uppercase;font-weight:900;font-size:18px;letter-spacing:.5px}
.rk-cta span{display:block;font-size:13px;opacity:.85;margin-top:3px}
@media (max-width:900px){
  .rk-wrap{padding-left:16px;padding-right:16px;padding-bottom:48px}
  .rk-h1{font-size:40px}
  .rk-head{align-items:stretch}
  .rk-tabs{width:100%}.rk-tab{flex:1;padding:9px 6px;font-size:12.5px}
  .rk-grid{grid-template-columns:1fr;gap:16px;margin-top:18px}
  .rk-side{position:static;gap:12px}
  .rk-opts{flex-direction:row;flex-wrap:wrap}
  .rk-opt{width:auto;padding:6px 11px;border-radius:999px;font-size:11.5px}
  .rk-card{padding:12px 8px}.rk-card.p0{padding:16px 10px 14px}
  .rk-table th{display:none}
  .rk-table td.ex,.rk-hide-m{display:none}
  .rk-player .m{display:block}
  .rk-table td:first-child{width:44px;padding-left:8px;padding-right:6px}
  .rk-table td{padding:9px 10px}
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
  const [rows, setRows]     = useState(null)   // null = ładowanie
  const [err, setErr]       = useState(false)

  useEffect(() => { document.title = `${t('title')} · HoopConnect` }, [t])
  useEffect(() => { supabase.rpc('rank_cities').then(({ data }) => setCities(Array.isArray(data) ? data : [])) }, [])
  useEffect(() => {
    let alive = true
    setRows(null); setErr(false)
    supabase.rpc('rank_board', { p_metric: metric, p_city: city, p_period: metric === 'matches' ? period : 'all', p_limit: 100 })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setErr(true); setRows([]) } else setRows(Array.isArray(data) ? data : [])
      })
    return () => { alive = false }
  }, [metric, city, period])

  const value = (r) => metric === 'xp' ? `${r.value} XP` : metric === 'kotc' ? `${r.value} 🏆` : `${r.value} ${t('wins')}`
  const mobileSub = (r) => metric === 'matches' ? `${r.played} ${t('games')} · ${r.pct ?? 0}%`
    : metric === 'kotc' ? `${r.played ?? 0} ${t('sessions')}` : (ARENAS[r.arena]?.name || '')
  const podium = rows ? rows.slice(0, 3) : []
  const rest   = rows ? rows.slice(3) : []

  return (
    <div className="rk">
      <style>{CSS}</style>
      <div className="rk-wrap">
        <div className="rk-brand">
          <img src="/hoop.svg" alt="" width="26" height="26" style={{ filter: 'drop-shadow(0 3px 10px rgba(91,184,245,0.45))' }} />
          <span>HoopConnect</span>
        </div>

        <div className="rk-head">
          <div>
            <h1 className="rk-h1">{t('title')}</h1>
            <p className="rk-sub">{t('subtitle')}</p>
          </div>
          <div className="rk-tabs" role="tablist">
            {METRICS.map(m => (
              <button key={m} role="tab" aria-selected={metric === m} className={`rk-tab${metric === m ? ' on' : ''}`} onClick={() => setMetric(m)}>
                {t(`tabs.${m}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="rk-grid">
          {/* Filtry — sidebar na desktopie, chipy na telefonie */}
          <aside className="rk-side">
            {metric === 'matches' && (
              <div>
                <p className="rk-gt">{t('periodLabel')}</p>
                <div className="rk-opts">
                  {['all', '30d'].map(p => (
                    <button key={p} className={`rk-opt${period === p ? ' on' : ''}`} onClick={() => setPeriod(p)}>{t(`period.${p}`)}</button>
                  ))}
                </div>
              </div>
            )}
            <div>
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
            {rows === null && <p className="rk-state">{t('loading')}</p>}
            {rows && err && <p className="rk-state err">{t('unavailable')}</p>}
            {rows && !err && rows.length === 0 && <p className="rk-state">{t('empty')}</p>}

            {podium.length > 0 && (
              <div className="rk-podium">
                {[podium[1], podium[0], podium[2]].map((r, i) => {
                  if (!r) return <div key={`e${i}`} />
                  const place = i === 1 ? 0 : i === 0 ? 1 : 2
                  const mine = r.user_id === me
                  return (
                    <div key={r.user_id} className={`rk-card p${place}`}
                      style={{ borderColor: `${mine ? '#5BB8F5' : MEDAL[place]}66`, boxShadow: `0 8px 30px ${MEDAL[place]}22` }}>
                      <div className="rk-place" style={{ color: MEDAL[place] }}>{place + 1}</div>
                      <div className="rk-hex"><HexAvatar name={r.name} variant={r.frame} size={place === 0 ? 84 : 64} noAnim /></div>
                      <div className="rk-name">{r.name}{mine ? ` · ${t('you')}` : ''}</div>
                      <div className="rk-val" style={{ color: MEDAL[place] }}>{value(r)}</div>
                      <div className="rk-small">{mobileSub(r)}</div>
                    </div>
                  )
                })}
              </div>
            )}

            {rest.length > 0 && (
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
                      <tr key={r.user_id} className={mine ? 'me' : ''}>
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
            )}

            {!me && rows && (
              <a href="/" className="rk-cta"><b>{t('cta')}</b><span>{t('ctaSub')}</span></a>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
