import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUI } from '../../context/UIContext'
import { useAuth } from '../../context/AuthContext'

const ORANGE = '#FFA820'
const BLUE   = '#00CCFF'
const PURPLE = '#9050FF'
const GREEN  = '#00C880'
const CY     = '#00FFEE'  // cyan glitch accent

/* ─── helpers ─────────────────────────────────────────────────── */
function getThisMonday() {
  const d = new Date()
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
  d.setHours(0,0,0,0); d.setDate(d.getDate()+diff); return d
}
function getNextMonday() { const m=getThisMonday(); m.setDate(m.getDate()+7); return m }
function fmtDate(d){ return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}) }
function pad(n){ return String(n).padStart(2,'0') }
function msToCD(ms){
  if(ms<=0)return{d:0,h:0,m:0,s:0}
  const s=Math.floor(ms/1000),min=Math.floor(s/60),h=Math.floor(min/60),d=Math.floor(h/24)
  return{d,h:h%24,m:min%60,s:s%60}
}

/* ─── section label ────────────────────────────────────────────── */
function SLabel({ children, mt = 36 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:mt, marginBottom:14 }}>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,transparent,${ORANGE}30)`}}/>
      <span style={{ fontSize:8.5, fontWeight:800, letterSpacing:3,
        textTransform:'uppercase', color:`${ORANGE}88`, flexShrink:0 }}>
        {children}
      </span>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg,${ORANGE}30,transparent)`}}/>
    </div>
  )
}

/* ─── countdown block ──────────────────────────────────────────── */
function CDBlock({ label, value }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{
        fontSize:22, fontWeight:900, color:'white',
        fontFamily:'var(--font-display)',
        background:'rgba(255,168,32,0.08)',
        border:`1px solid ${ORANGE}30`,
        borderTop:`1px solid ${ORANGE}55`,
        borderBottom:`1px solid ${ORANGE}55`,
        borderRadius:0, padding:'6px 10px', minWidth:44,
        letterSpacing:1,
      }}>{pad(value)}</div>
      <p style={{ fontSize:7.5, fontWeight:700, color:`${ORANGE}55`,
        letterSpacing:2, textTransform:'uppercase', margin:'4px 0 0' }}>{label}</p>
    </div>
  )
}

/* ─── prize image placeholder ──────────────────────────────────── */
function PrizePlaceholder({ color, height=110 }) {
  return (
    <div style={{
      height, position:'relative', overflow:'hidden',
      background:`linear-gradient(135deg,${color}10,rgba(0,0,0,0.4))`,
      borderBottom:`1px solid ${color}20`,
      display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      {/* scanline overlay */}
      <div style={{
        position:'absolute', inset:0, zIndex:1,
        backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)`,
        pointerEvents:'none',
      }}/>
      {/* grid */}
      <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.08}}
        viewBox="0 0 100 100" preserveAspectRatio="none">
        {[20,40,60,80].map(x=><line key={x} x1={x} y1="0" x2={x} y2="100" stroke={color} strokeWidth="0.5"/>)}
        {[25,50,75].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} stroke={color} strokeWidth="0.5"/>)}
      </svg>
      <div style={{textAlign:'center',position:'relative',zIndex:2}}>
        <div style={{
          width:40,height:40,margin:'0 auto 7px',
          border:`1.5px dashed ${color}50`,
          display:'flex',alignItems:'center',justifyContent:'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <rect x="3" y="3" width="18" height="18" rx="0"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <p style={{fontSize:8,color:`${color}66`,margin:0,letterSpacing:2,
          textTransform:'uppercase',fontWeight:700}}>Grafika nagrody</p>
      </div>
    </div>
  )
}

/* ─── tier carousel ────────────────────────────────────────────── */
const TIERS = [
  { label:'Brąz',    color:'#CD7F32', min:0,   max:249,
    desc:'Punkt startowy każdego gracza.',
    sub:'Zacznij trenować i zbieraj punkty do wyższej ligi.' },
  { label:'Srebro',  color:'#C0C0C0', min:250, max:449,
    desc:'Budujesz regularny nawyk treningowy.',
    sub:'Utrzymaj aktywność przez kilka tygodni.' },
  { label:'Złoto',   color:'#FFD700', min:450, max:649,
    desc:'Zaangażowany gracz realizujący plan.',
    sub:'Co najmniej 70% zaplanowanych treningów tygodniowo.' },
  { label:'Platyna', color:'#5BB8F5', min:650, max:819,
    desc:'Doświadczony zawodnik — wysoka konsekwencja.',
    sub:'Regularny udział w sesjach i spotkaniach klubowych.' },
  { label:'Diament', color:'#B9F2FF', min:820, max:1000,
    desc:'Absolutna elita sezonu.',
    sub:'Tylko dla graczy z pełnym zaangażowaniem każdego tygodnia.' },
]

function TierCarousel() {
  const [active, setActive] = useState(0)
  const ref = useRef(null)

  function scrollTo(idx) {
    setActive(idx)
    const el = ref.current; if(!el) return
    const w = el.scrollWidth / TIERS.length
    el.scrollTo({ left: idx * w, behavior:'smooth' })
  }
  function onScroll() {
    const el = ref.current; if(!el) return
    const w = el.scrollWidth / TIERS.length
    setActive(Math.min(Math.max(Math.round(el.scrollLeft/w),0),TIERS.length-1))
  }

  return (
    <div style={{ marginBottom:0 }}>
      <div ref={ref} onScroll={onScroll} style={{
        display:'flex', overflowX:'scroll', gap:10,
        paddingLeft:18, paddingRight:18, margin:'0 -18px',
        scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch',
        scrollbarWidth:'none',
      }}>
        {TIERS.map((t,i) => (
          <div key={t.label} onClick={()=>scrollTo(i)} style={{
            scrollSnapAlign:'center', flexShrink:0,
            width:'calc(100% - 64px)',
            background:`linear-gradient(135deg,${t.color}0E,rgba(0,0,0,0.3))`,
            border:`1px solid ${t.color}${active===i?'50':'18'}`,
            borderTop:`1px solid ${t.color}${active===i?'99':'35'}`,
            borderBottom:`1px solid ${t.color}${active===i?'99':'35'}`,
            padding:'18px 16px',
            position:'relative',
            cursor:'pointer',
            transition:'border-color 0.25s',
          }}>
            {/* corner accents — active only */}
            {active===i && <>
              <div style={{position:'absolute',top:-1,left:-1,width:14,height:14,
                borderTop:`2px solid ${t.color}`,borderLeft:`2px solid ${t.color}`}}/>
              <div style={{position:'absolute',bottom:-1,right:-1,width:14,height:14,
                borderBottom:`2px solid ${t.color}`,borderRight:`2px solid ${t.color}`}}/>
            </>}

            <div style={{display:'flex',alignItems:'center',
              justifyContent:'space-between',marginBottom:12}}>
              <div style={{display:'flex',alignItems:'center',gap:9}}>
                <div style={{width:10,height:10,background:t.color,flexShrink:0,
                  boxShadow:`0 0 8px ${t.color}99`}}/>
                <span style={{fontSize:19,fontWeight:900,color:t.color,
                  fontFamily:'var(--font-display)',letterSpacing:1}}>
                  {t.label.toUpperCase()}
                </span>
              </div>
              <span style={{fontSize:10,fontWeight:800,color:`${t.color}88`,
                fontFamily:'var(--font-display)'}}>
                {t.min}–{t.max} PKT
              </span>
            </div>
            <div style={{height:1,background:`${t.color}20`,marginBottom:12}}/>
            <p style={{fontSize:12.5,fontWeight:700,
              color:'rgba(255,255,255,0.85)',margin:'0 0 5px',lineHeight:1.4}}>
              {t.desc}
            </p>
            <p style={{fontSize:10,color:'rgba(255,255,255,0.38)',margin:0,lineHeight:1.55}}>
              {t.sub}
            </p>
          </div>
        ))}
      </div>
      {/* dots */}
      <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:10}}>
        {TIERS.map((tier,i)=>(
          <div key={i} onClick={()=>scrollTo(i)} style={{
            width:active===i?18:5, height:5,
            background:active===i?tier.color:'rgba(255,255,255,0.12)',
            transition:'width 0.25s,background 0.25s', cursor:'pointer',
          }}/>
        ))}
      </div>
    </div>
  )
}

/* ─── countdown — own component so only IT re-renders every second ─ */
const SLIDE = { type: 'tween', duration: 0.28, ease: [0.16, 1, 0.3, 1] }

function CountdownTimer({ open, isWaiting, nextStart }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  const cd = msToCD(getNextMonday() - Date.now())

  return (
    <div style={{ padding:'4px 0 32px', position:'relative' }}>
      <p style={{ fontSize:8.5, fontWeight:700, letterSpacing:2.5,
        textTransform:'uppercase', color:`${ORANGE}44`,
        margin:'0 0 12px', textAlign:'center' }}>
        {isWaiting ? '— punkty startują za —' : '— reset ligi za —'}
      </p>
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8 }}>
        {cd.d > 0 && <><CDBlock label="dni" value={cd.d}/><Sep/></>}
        <CDBlock label="godz" value={cd.h}/>
        <Sep/>
        <CDBlock label="min" value={cd.m}/>
        <Sep/>
        <CDBlock label="sek" value={cd.s}/>
      </div>
      <p style={{ fontSize:9, color:`${ORANGE}44`, textAlign:'center',
        margin:'11px 0 0', letterSpacing:1 }}>
        {isWaiting
          ? <><strong style={{color:`${ORANGE}77`}}>START: {nextStart.toUpperCase()}</strong> · 00:00</>
          : <><strong style={{color:`${ORANGE}77`}}>ZAMKNIĘCIE: {nextStart.toUpperCase()}</strong> · 00:00</>}
      </p>
    </div>
  )
}

/* ─── league status helper ──────────────────────────────────────── */
// Returns 'notEligible' | 'waitingNextWeek' | 'active'
// Rules:
//   • Player needs ≥7 days since created_at before they can join the league
//   • Even if eligible today, they enter at the START OF THE NEXT week (next Monday 00:00)
//   • So: active only if (created_at + 7d) is BEFORE thisMonday
function getLeagueStatus(createdAt) {
  if (!createdAt) return 'notEligible'
  const eligible7d = new Date(createdAt).getTime() + 7 * 24 * 3600 * 1000
  const thisM      = getThisMonday().getTime()
  const nextM      = getNextMonday().getTime()
  if (eligible7d <= thisM)   return 'active'
  if (eligible7d <= nextM)   return 'waitingNextWeek'
  return 'notEligible'
}

/* ─── main ─────────────────────────────────────────────────────── */
export default function LeagueInfoPanel({ open, onClose }) {
  const { setLeaderboardOpen, setLeaderboardFromLeague } = useUI()
  const { profile } = useAuth()

  const thisMonday = getThisMonday()
  const nextMonday = getNextMonday()
  const status     = getLeagueStatus(profile?.created_at)
  const isActive   = status === 'active'
  const isWaiting  = status === 'waitingNextWeek'  // eligible but joining next week
  // notEligible: days remaining until 7-day mark
  const daysLeft   = profile?.created_at
    ? Math.max(0, Math.ceil((new Date(profile.created_at).getTime() + 7*24*3600*1000 - Date.now()) / 86400000))
    : 7
  const weekPct    = Math.min(1,(Date.now()-thisMonday.getTime())/(7*24*3600*1000))
  const weekLabel  = `${fmtDate(thisMonday)} – ${fmtDate(new Date(nextMonday-86400000))}`
  const nextStart  = fmtDate(nextMonday)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="li-bd"
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            transition={{duration:0.2}}
            onClick={onClose}
            style={{position:'fixed',inset:0,zIndex:500,
              background:'rgba(2,5,12,0.90)',backdropFilter:'blur(6px)',
              WebkitBackdropFilter:'blur(6px)'}}
          />

          <motion.div key="li-sheet"
            initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
            transition={SLIDE}
            style={{
              position:'fixed',
              left:'max(0px, calc((100vw - 430px) / 2))',
              width:'min(100vw, 430px)',
              bottom:0,zIndex:501,
              background:'linear-gradient(180deg,#060C16 0%,#030810 100%)',
              borderRadius:'20px 20px 0 0',
              borderTop:'none',
              maxHeight:'94dvh',
              willChange:'transform',
              contain:'layout style',
              overflowY:'auto',
              WebkitOverflowScrolling:'touch',
            }}
          >

            {/* close */}
            <button onClick={onClose} style={{
              position:'absolute',right:14,top:14,zIndex:10,
              width:28,height:28,
              background:'rgba(255,168,32,0.10)',
              border:`1px solid ${ORANGE}40`,
              borderRadius:0,
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
              WebkitTapHighlightColor:'transparent',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke={`${ORANGE}88`} strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div style={{padding:'0 18px calc(env(safe-area-inset-bottom,0px) + 28px)'}}>

              {/* ── LOGO ──────────────────────────────────────────── */}
              <div style={{margin:'28px -18px 0', position:'relative'}}>
                <img src="/logo-league.png" alt="Liga HoopConnect First Season"
                  style={{width:'100%',height:'auto',
                    mixBlendMode:'screen',display:'block',
                    userSelect:'none',pointerEvents:'none'}}/>
                {/* scanline on logo */}
                <div style={{position:'absolute',inset:0,pointerEvents:'none',
                  backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.12) 3px,rgba(0,0,0,0.12) 4px)'}}/>
              </div>

              {/* ── SEASON DESCRIPTION — no border, centered ──────── */}
              <div style={{
                margin:'28px 0 32px',
                padding:'0 8px',
                textAlign:'center',
              }}>
                <p style={{fontSize:9,fontWeight:800,letterSpacing:3,color:`${CY}70`,
                  textTransform:'uppercase',margin:'0 0 10px'}}>
                  ◆ Season 01 · Connect All
                </p>
                <p style={{fontSize:14,fontWeight:700,
                  color:'rgba(255,255,255,0.82)',margin:'0 0 8px',lineHeight:1.5}}>
                  Pierwszy sezon HoopConnect w Polsce.
                </p>
                <p style={{fontSize:11.5,color:'rgba(255,255,255,0.38)',margin:0,lineHeight:1.65}}>
                  Rywalizuj co tydzień — treningi, mecze i osiągnięcia przekładają się na punkty ligowe. Liga resetuje się każdy poniedziałek o 00:00. Aby dołączyć, musisz być aktywny przez <span style={{color:'rgba(255,255,255,0.62)',fontWeight:700}}>minimum 7 dni</span> — wchodzisz wtedy od startu kolejnego tygodnia.
                </p>
              </div>

              {/* ── STATUS ────────────────────────────────────────── */}
              {(() => {
                // colour per state
                const sc = isActive ? GREEN : isWaiting ? ORANGE : 'rgba(140,160,185,0.70)'
                const bg = isActive ? `${GREEN}08` : isWaiting ? `${ORANGE}0C` : 'rgba(255,255,255,0.02)'
                return (
                  <div style={{
                    marginBottom:20,
                    border:`1px solid ${sc}30`,
                    borderTop:`1px solid ${sc}60`,
                    borderBottom:`1px solid ${sc}60`,
                    background:`linear-gradient(135deg,${bg},transparent)`,
                    padding:'12px 14px',
                    position:'relative',
                  }}>
                    <div style={{position:'absolute',top:-1,left:-1,width:10,height:10,
                      borderTop:`1.5px solid ${sc}`,borderLeft:`1.5px solid ${sc}`}}/>
                    <div style={{position:'absolute',bottom:-1,right:-1,width:10,height:10,
                      borderBottom:`1.5px solid ${sc}`,borderRight:`1.5px solid ${sc}`}}/>

                    {/* ── ACTIVE ── */}
                    {isActive && (
                      <>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                          <div style={{width:7,height:7,flexShrink:0,background:GREEN}}/>
                          <div style={{flex:1}}>
                            <p style={{fontSize:9.5,fontWeight:800,letterSpacing:1.8,
                              textTransform:'uppercase',color:GREEN,margin:'0 0 2px'}}>
                              Aktywny uczestnik
                            </p>
                            <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',margin:0}}>
                              Tydzień · {weekLabel}
                            </p>
                          </div>
                        </div>
                        <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                          <span style={{fontSize:8.5,color:`${ORANGE}55`}}>{fmtDate(thisMonday)}</span>
                          <span style={{fontSize:8.5,color:`${ORANGE}55`}}>{Math.round(weekPct*100)}%</span>
                          <span style={{fontSize:8.5,color:`${ORANGE}55`}}>{fmtDate(new Date(nextMonday-86400000))}</span>
                        </div>
                        <div style={{height:3,background:'rgba(255,255,255,0.06)'}}>
                          <div style={{height:'100%',width:`${weekPct*100}%`,
                            background:`linear-gradient(90deg,${GREEN},#007A40)`}}/>
                        </div>
                      </>
                    )}

                    {/* ── WAITING (eligible, but this week doesn't count) ── */}
                    {isWaiting && (
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:7,height:7,flexShrink:0,background:ORANGE,
                          boxShadow:`0 0 8px ${ORANGE}`}}/>
                        <div style={{flex:1}}>
                          <p style={{fontSize:9.5,fontWeight:800,letterSpacing:1.8,
                            textTransform:'uppercase',color:ORANGE,margin:'0 0 2px'}}>
                            Gotowy — start od następnego tygodnia
                          </p>
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',margin:0}}>
                            Twoje punkty liczą się od <strong style={{color:'rgba(255,255,255,0.65)'}}>{nextStart}</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── NOT ELIGIBLE ── */}
                    {!isActive && !isWaiting && (
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:7,height:7,flexShrink:0,
                          background:'rgba(140,160,185,0.50)'}}/>
                        <div style={{flex:1}}>
                          <p style={{fontSize:9.5,fontWeight:800,letterSpacing:1.8,
                            textTransform:'uppercase',color:'rgba(160,185,210,0.70)',margin:'0 0 2px'}}>
                            {daysLeft > 1 ? `Kwalifikacja za ${daysLeft} dni` : 'Kwalifikacja jutro'}
                          </p>
                          <p style={{fontSize:11,color:'rgba(255,255,255,0.38)',margin:0}}>
                            Potrzebujesz pierwszego raportu tygodniowego — bądź aktywny przez 7 dni, by dołączyć do ligi.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* ── COUNTDOWN — isolated component (only it re-renders/s) ── */}
              <CountdownTimer open={open} isWaiting={!isActive} nextStart={nextStart}/>

              {/* ── NAGRODY ───────────────────────────────────────── */}
              <SLabel mt={0}>Nagrody za sezon</SLabel>

              {/* 1st — full glowing frame */}
              <div style={{
                marginBottom:8,
                border:`1px solid ${ORANGE}60`,
                borderTop:`2px solid ${ORANGE}`,
                borderBottom:`2px solid ${ORANGE}`,
                position:'relative',
                overflow:'hidden',
                boxShadow:`0 0 28px ${ORANGE}20, inset 0 0 28px ${ORANGE}06`,
              }}>
                <PrizePlaceholder color={ORANGE} height={120}/>
                <div style={{
                  padding:'13px 15px',
                  background:`linear-gradient(135deg,${ORANGE}10,rgba(0,0,0,0.3))`,
                  display:'flex',alignItems:'center',gap:12,
                }}>
                  <div style={{
                    width:36,height:36,flexShrink:0,
                    background:`${ORANGE}1A`,
                    border:`1px solid ${ORANGE}50`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                  }}>
                    <span style={{fontSize:16,fontWeight:900,color:ORANGE,
                      fontFamily:'var(--font-display)'}}>1</span>
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontSize:15,fontWeight:800,
                      color:'rgba(255,255,255,0.95)',margin:'0 0 2px'}}>Koszulka NBA</p>
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.38)',margin:0}}>
                      Oryginalna koszulka do wyboru · miejsce 1.
                    </p>
                  </div>
                  <div style={{width:8,height:8,background:ORANGE,flexShrink:0,
                    boxShadow:`0 0 10px ${ORANGE}, 0 0 20px ${ORANGE}88`}}/>
                </div>
              </div>

              {/* 2nd & 3rd — no border, only corner accents */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:0}}>
                {[
                  {rank:'2',color:BLUE,  prize:'Kupon 150 zł'},
                  {rank:'3',color:PURPLE,prize:'Kupon 150 zł'},
                ].map(r=>(
                  <div key={r.rank} style={{
                    overflow:'hidden',position:'relative',
                    background:`linear-gradient(135deg,${r.color}08,rgba(0,0,0,0.35))`,
                  }}>
                    {/* corner accents only */}
                    <div style={{position:'absolute',top:0,left:0,width:12,height:12,
                      borderTop:`1.5px solid ${r.color}`,borderLeft:`1.5px solid ${r.color}`,zIndex:2}}/>
                    <div style={{position:'absolute',top:0,right:0,width:12,height:12,
                      borderTop:`1.5px solid ${r.color}`,borderRight:`1.5px solid ${r.color}`,zIndex:2}}/>
                    <div style={{position:'absolute',bottom:0,left:0,width:12,height:12,
                      borderBottom:`1.5px solid ${r.color}`,borderLeft:`1.5px solid ${r.color}`,zIndex:2}}/>
                    <div style={{position:'absolute',bottom:0,right:0,width:12,height:12,
                      borderBottom:`1.5px solid ${r.color}`,borderRight:`1.5px solid ${r.color}`,zIndex:2}}/>
                    <PrizePlaceholder color={r.color} height={70}/>
                    <div style={{
                      padding:'10px 11px',
                      display:'flex',alignItems:'center',gap:8,
                    }}>
                      <span style={{fontSize:15,fontWeight:900,color:r.color,
                        fontFamily:'var(--font-display)',flexShrink:0}}>{r.rank}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:12,fontWeight:700,
                          color:'rgba(255,255,255,0.88)',margin:'0 0 1px',
                          overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {r.prize}
                        </p>
                        <p style={{fontSize:9,color:'rgba(255,255,255,0.3)',margin:0}}>
                          Sklep koszykarski
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── POZIOMY ───────────────────────────────────────── */}
              <SLabel>Poziomy ligowe</SLabel>
              <TierCarousel />

              {/* ── PUNKTY ────────────────────────────────────────── */}
              <SLabel>Źródła punktów</SLabel>
              <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:0}}>
                {[
                  { label:'Mecz klubowy',       sub:'Potwierdzony udział w meczu drużynowym',
                    pts:'+50', weight:'×1.0', wC:'#00E676', accent:'#00E676' },
                  { label:'Sesja rzutów',        sub:'Ukończona sesja rejestrowana w aplikacji',
                    pts:'+30', weight:'×1.0', wC:'#00E676', accent:'#00C870' },
                  { label:'Osiągnięcia',         sub:'Brąz +20 · Srebro +30 · Złoto +50 · Platyna +75 · Diament +100',
                    pts:'+20–100', weight:'×0.75', wC:ORANGE, accent:ORANGE },
                  { label:'Trening (100% planu)',sub:'Wszystkie ćwiczenia dnia oznaczone jako wykonane',
                    pts:'+15–80', weight:'×0.5', wC:'#8A9BB0', accent:'#5A7090' },
                  { label:'Seria tygodniowa',    sub:'Bonus za każdy kolejny tydzień aktywności bez przerwy',
                    pts:'+80', weight:'×1.0', wC:'#FF6B35', accent:'#FF6B35' },
                ].map(s=>(
                  <div key={s.label} style={{
                    display:'flex',alignItems:'stretch',
                    background:'rgba(255,255,255,0.025)',
                    border:'1px solid rgba(255,255,255,0.07)',
                    borderTop:'1px solid rgba(255,255,255,0.12)',
                    borderBottom:'1px solid rgba(255,255,255,0.12)',
                    position:'relative',
                  }}>
                    <div style={{width:3,flexShrink:0,
                      background:`linear-gradient(180deg,${s.accent}DD,${s.accent}33)`}}/>
                    <div style={{flex:1,padding:'10px 12px',minWidth:0}}>
                      <p style={{fontSize:12.5,fontWeight:700,
                        color:'rgba(255,255,255,0.88)',margin:'0 0 3px'}}>{s.label}</p>
                      <p style={{fontSize:9.5,color:'rgba(255,255,255,0.30)',
                        margin:0,lineHeight:1.45}}>{s.sub}</p>
                    </div>
                    <div style={{padding:'10px 12px',textAlign:'right',flexShrink:0,
                      borderLeft:'1px solid rgba(255,255,255,0.05)',
                      display:'flex',flexDirection:'column',
                      alignItems:'flex-end',justifyContent:'center',gap:4}}>
                      {/* pts — elegant, muted white */}
                      <p style={{fontSize:13,fontWeight:800,
                        color:'rgba(255,255,255,0.70)',
                        fontFamily:'var(--font-display)',
                        letterSpacing:0.5,
                        margin:0}}>{s.pts} <span style={{fontSize:9,color:'rgba(255,255,255,0.28)',fontWeight:600,letterSpacing:0.5}}>PKT</span></p>
                      <div style={{padding:'2px 5px',background:`${s.wC}12`,
                        border:`1px solid ${s.wC}25`}}>
                        <span style={{fontSize:8,fontWeight:700,
                          color:`${s.wC}88`,letterSpacing:0.3}}>liga {s.weight}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── ZASADY ────────────────────────────────────────── */}
              <SLabel>Zasady ligi</SLabel>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:0}}>
                {[
                  {title:'Liga tygodniowa',   body:'Pon–niedz, reset w poniedziałek 00:00'},
                  {title:'7 dni stażu',       body:'Musisz mieć pierwszy raport tygodniowy, by dołączyć do ligi'},
                  {title:'Start od pon.',     body:'Wchodzisz zawsze od początku nowego tygodnia — nie w trakcie'},
                  {title:'Fair play',         body:'Treningi liczą się z mnożnikiem ×0.5 · mecze i rzuty ×1.0'},
                ].map(item=>(
                  <div key={item.title} style={{
                    padding:'11px 12px',
                    background:'rgba(255,255,255,0.025)',
                    border:'1px solid rgba(255,255,255,0.07)',
                    borderTop:'1px solid rgba(255,255,255,0.12)',
                    borderBottom:'1px solid rgba(255,255,255,0.12)',
                    position:'relative',
                  }}>
                    <div style={{position:'absolute',top:-1,left:-1,width:8,height:8,
                      borderTop:`1px solid ${ORANGE}55`,borderLeft:`1px solid ${ORANGE}55`}}/>
                    <div style={{position:'absolute',bottom:-1,right:-1,width:8,height:8,
                      borderBottom:`1px solid ${ORANGE}55`,borderRight:`1px solid ${ORANGE}55`}}/>
                    <p style={{fontSize:11.5,fontWeight:700,
                      color:'rgba(255,255,255,0.85)',margin:'0 0 4px'}}>{item.title}</p>
                    <p style={{fontSize:10,color:'rgba(255,255,255,0.35)',
                      margin:0,lineHeight:1.55}}>{item.body}</p>
                  </div>
                ))}
              </div>

              {/* ── CTA ───────────────────────────────────────────── */}
              <div style={{marginTop:36}}/>
              <motion.button whileTap={{scale:0.97}}
                onClick={()=>{
                  setLeaderboardFromLeague(true)
                  setLeaderboardOpen(true)   // otwórz ranking (zIndex 600, przykrywa ligę)
                  setTimeout(onClose, 80)    // zamknij ligę w tle — niewidoczne pod rankiniem
                }}
                style={{
                  width:'100%',padding:'15px',border:'none',
                  borderRadius:0,
                  borderTop:`2px solid ${ORANGE}`,
                  cursor:'pointer',
                  background:`linear-gradient(135deg,#FFD060 0%,${ORANGE} 55%,#B85000 100%)`,
                  color:'rgba(0,0,0,0.82)',fontFamily:'var(--font-display)',fontWeight:900,
                  fontSize:12.5,letterSpacing:3,textTransform:'uppercase',
                  boxShadow:`0 -4px 24px ${ORANGE}30`,
                  WebkitTapHighlightColor:'transparent',
                  position:'relative',
                }}>
                <div style={{position:'absolute',top:0,left:0,width:10,height:10,
                  borderTop:`2px solid rgba(0,0,0,0.3)`,borderLeft:`2px solid rgba(0,0,0,0.3)`}}/>
                <div style={{position:'absolute',top:0,right:0,width:10,height:10,
                  borderTop:`2px solid rgba(0,0,0,0.3)`,borderRight:`2px solid rgba(0,0,0,0.3)`}}/>
                RANKING — AKTUALNY TYDZIEŃ
              </motion.button>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Sep(){
  return <span style={{fontSize:18,fontWeight:200,color:`${ORANGE}30`,
    marginBottom:14,userSelect:'none',letterSpacing:0}}>:</span>
}
