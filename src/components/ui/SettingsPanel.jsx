import { useState, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { HexFrameOnly } from './HexAvatar'

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}
const DAY_SHORT  = ['Nd','Pon','Wt','Śr','Czw','Pt','Sob']
const APP_VERSION = '1.2.0-beta'
const SLIDE = { type: 'tween', duration: 0.22, ease: [0.16, 1, 0.3, 1] }

/* ─── shared close button (fixed position, same spot every view) ─ */
function CloseBtn({ onClose }) {
  return (
    <button onClick={onClose} style={{
      position: 'absolute', top: 14, right: 18, zIndex: 20,
      width: 30, height: 30, borderRadius: '50%',
      background: '#E8EDF5', border: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="#4A5568" strokeWidth="2.8" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  )
}

/* ─── sub-panel header (back arrow + title, no ✕ — handled above) ─ */
function SubHeader({ title, onBack }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 56px 10px 18px',  // right pad leaves room for abs ✕
      borderBottom: '1px solid #EDF1F7', flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        width: 28, height: 28, borderRadius: '50%',
        background: '#EEF2F8', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke="#4A5568" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 2,
        textTransform: 'uppercase', color: '#8A9BB0', margin: 0,
      }}>{title}</p>
    </div>
  )
}

/* ─── nav row ───────────────────────────────────────────────────── */
function NavRow({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', background: '#fff',
      border: '1px solid #EDF1F7', borderRadius: 10,
      width: '100%', cursor: 'pointer', textAlign: 'left',
      WebkitTapHighlightColor: 'transparent',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2840', margin: 0 }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: '#8A9BB0', margin: '2px 0 0' }}>{sub}</p>}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </button>
  )
}

/* ─── section label ─────────────────────────────────────────────── */
function SLabel({ children }) {
  return (
    <p style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: 2,
      textTransform: 'uppercase', color: '#A0B0C8', margin: '18px 0 7px',
    }}>{children}</p>
  )
}

/* ─── text input row ────────────────────────────────────────────── */
function InputRow({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #EDF1F7',
      borderRadius: 10, padding: '10px 14px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
        textTransform: 'uppercase', color: '#A0B0C8', margin: '0 0 4px' }}>
        {label}
      </p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', border: 'none', outline: 'none',
          fontSize: 13, fontWeight: 500, color: '#1A2840',
          background: 'transparent', padding: 0,
          fontFamily: 'var(--font-body)',
        }}
      />
    </div>
  )
}

/* ─── week picker ───────────────────────────────────────────────── */
function WeekPicker({ trainingDays, open }) {
  const maxDays = trainingDays || 4
  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() + i); return d
    })
  }, [])
  const schedule = SCHEDULES[maxDays] || SCHEDULES[4]
  const initSelected = useMemo(() => new Set(
    days.map((d, i) => {
      const dow = d.getDay(); const idx = dow === 0 ? 6 : dow - 1
      return schedule[idx] === 'T' ? i : null
    }).filter(i => i !== null)
  ), [])
  const [selected, setSelected] = useState(initSelected)
  const [showWarn, setShowWarn] = useState(false)
  useEffect(() => {
    if (!open && selected.size !== maxDays) { setSelected(new Set(initSelected)); setShowWarn(false) }
  }, [open])
  function toggle(i) {
    setShowWarn(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) { next.delete(i) }
      else if (next.size >= maxDays) { setShowWarn(true); return prev }
      else { next.add(i) }
      return next
    })
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 4 }}>
        {days.map((d, i) => {
          const isToday = i === 0; const isSel = selected.has(i)
          return (
            <button key={i} onClick={() => toggle(i)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '9px 0 7px', borderRadius: 9,
              border: isToday ? `2px solid ${isSel ? '#E8600A' : '#FF8C42'}` : '2px solid transparent',
              background: isSel ? (isToday ? '#E8600A' : '#1B3A6B') : (isToday ? 'rgba(255,140,66,0.10)' : '#DDE4EF'),
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'background 0.15s',
            }}>
              <span style={{ fontFamily:'var(--font-display)', fontSize:14, fontWeight:600, lineHeight:1,
                color: isSel ? '#fff' : isToday ? '#E8600A' : '#4A5568' }}>{d.getDate()}</span>
              <span style={{ fontSize:7.5, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase',
                color: isSel ? 'rgba(255,255,255,0.70)' : isToday ? '#FF8C42' : '#B8C5D4', lineHeight:1 }}>
                {DAY_SHORT[d.getDay()]}
              </span>
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {showWarn && (
          <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{ fontSize:10, color:'#E8600A', fontWeight:600, marginTop:7, textAlign:'center' }}>
            Limit {maxDays} dni — odznacz dzień żeby zmienić inny.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ─── sub: Konto ────────────────────────────────────────────────── */
function AccountView({ onBack, open, profile, user, onProfileSaved }) {
  const [name,      setName]      = useState(profile?.name      || '')
  const [birthDate, setBirthDate] = useState(profile?.birth_date || '')
  const [city,      setCity]      = useState(profile?.city       || '')
  const [saveState, setSaveState] = useState('idle')  // idle | saving | saved | error
  const [pwState,   setPwState]   = useState('idle')
  const [delState,  setDelState]  = useState('idle')

  async function handleSaveProfile() {
    setSaveState('saving')
    try {
      const { error } = await supabase.from('profiles').update({
        name:       name.trim(),
        birth_date: birthDate || null,
        city:       city.trim() || null,
      }).eq('id', user.id)
      if (error) throw error
      setSaveState('saved')
      onProfileSaved?.()
      setTimeout(() => setSaveState('idle'), 2200)
    } catch { setSaveState('error'); setTimeout(() => setSaveState('idle'), 2200) }
  }

  async function handlePasswordReset() {
    setPwState('sending')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      })
      setPwState(error ? 'error' : 'sent')
    } catch { setPwState('error') }
  }

  const dirty = name !== (profile?.name || '') ||
    birthDate !== (profile?.birth_date || '') ||
    city !== (profile?.city || '')

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <SubHeader title="Konto" onBack={onBack}/>
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'0 18px 28px' }}>

        {/* ── Profil ── */}
        <SLabel>Profil</SLabel>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          <InputRow label="Imię / Nazwa" value={name} onChange={setName} placeholder="Twoja nazwa"/>
          <InputRow label="Data urodzenia" value={birthDate} onChange={setBirthDate} type="date"/>
          <InputRow label="Miasto" value={city} onChange={setCity} placeholder="np. Warszawa"/>
        </div>

        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
              transition={{ duration:0.18 }}
              onClick={handleSaveProfile}
              disabled={saveState === 'saving'}
              style={{
                width:'100%', marginTop:10, padding:'11px',
                background: saveState === 'saved' ? '#27AE60' : saveState === 'error' ? '#C0392B' : '#1B3A6B',
                border:'none', borderRadius:10, cursor:'pointer',
                fontSize:12, fontWeight:700, color:'#fff', letterSpacing:0.5,
                WebkitTapHighlightColor:'transparent',
                opacity: saveState === 'saving' ? 0.7 : 1,
                transition: 'background 0.2s',
              }}>
              {saveState === 'saved' ? '✓ Zapisano' : saveState === 'error' ? 'Błąd — spróbuj ponownie' : saveState === 'saving' ? 'Zapisywanie…' : 'Zapisz zmiany'}
            </motion.button>
          )}
        </AnimatePresence>

        {/* ── Plan tygodnia ── */}
        <SLabel>Plan tygodnia</SLabel>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
          <div style={{ flex:1, height:1, background:'rgba(160,176,200,0.28)' }}/>
          <span style={{ fontSize:7.5, color:'#B0C0D4', fontStyle:'italic', whiteSpace:'nowrap' }}>
            odkliknij dzień i zaznacz inny
          </span>
          <div style={{ flex:1, height:1, background:'rgba(160,176,200,0.28)' }}/>
        </div>
        <WeekPicker trainingDays={profile?.training_days} open={open}/>

        {/* ── Email ── */}
        <SLabel>Email</SLabel>
        <div style={{
          display:'flex', alignItems:'center', gap:10,
          padding:'10px 12px', background:'#fff',
          border:'1px solid #EDF1F7', borderRadius:10,
          boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
        }}>
          <div style={{
            width:28, height:28, borderRadius:8, flexShrink:0,
            background: user?.email_confirmed_at ? 'rgba(39,174,96,0.10)' : 'rgba(232,96,10,0.08)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={user?.email_confirmed_at ? '#27AE60' : '#E8600A'} strokeWidth="2.2" strokeLinecap="round">
              {user?.email_confirmed_at
                ? <polyline points="20 6 9 17 4 12"/>
                : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:11.5, fontWeight:600, margin:0,
              color: user?.email_confirmed_at ? '#27AE60' : '#1A2840' }}>
              {user?.email_confirmed_at ? 'Email potwierdzony' : 'Email niepotwierdzony'}
            </p>
            <p style={{ fontSize:10, color:'#8A9BB0', margin:'1px 0 0',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* ── Hasło ── */}
        <SLabel>Hasło</SLabel>
        <button onClick={handlePasswordReset}
          disabled={pwState === 'sending' || pwState === 'sent'}
          style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'12px 14px', background:'#fff',
            border:'1px solid #EDF1F7', borderRadius:10,
            width:'100%', cursor: pwState === 'sent' ? 'default' : 'pointer',
            textAlign:'left', WebkitTapHighlightColor:'transparent',
            boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
            opacity: pwState === 'sending' ? 0.6 : 1,
          }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:600, margin:0,
              color: pwState === 'sent' ? '#27AE60' : pwState === 'error' ? '#C0392B' : '#1A2840' }}>
              {pwState === 'sent' ? '✓ Link wysłany na email' : pwState === 'error' ? 'Błąd — spróbuj ponownie' : 'Zmień hasło'}
            </p>
            {pwState === 'idle' && (
              <p style={{ fontSize:10, color:'#8A9BB0', margin:'2px 0 0' }}>
                Link resetujący wysyłamy na Twój email
              </p>
            )}
          </div>
          {pwState === 'idle' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </button>

        {/* ── Usuń konto ── */}
        <div style={{ marginTop:28, textAlign:'center' }}>
          {delState === 'idle' ? (
            <button onClick={() => setDelState('confirm')} style={{
              background:'none', border:'none', cursor:'pointer',
              fontSize:11, fontWeight:500, color:'#C0392B',
              WebkitTapHighlightColor:'transparent', padding:'4px 8px',
              textDecoration:'underline', textUnderlineOffset:3,
            }}>
              Usuń konto
            </button>
          ) : (
            <div style={{
              background:'rgba(192,57,43,0.06)', border:'1px solid rgba(192,57,43,0.18)',
              borderRadius:10, padding:'12px 14px',
            }}>
              <p style={{ fontSize:11.5, fontWeight:600, color:'#C0392B', margin:'0 0 4px' }}>Czy na pewno?</p>
              <p style={{ fontSize:10, color:'#8A9BB0', margin:'0 0 12px', lineHeight:1.5 }}>
                Tej akcji nie można cofnąć. Skontaktuj się z nami.
              </p>
              <a href="mailto:kontakt@hoopconnect.pl?subject=Usunięcie konta"
                style={{
                  display:'block', padding:'8px', background:'#C0392B',
                  borderRadius:7, fontSize:11, fontWeight:700, color:'#fff',
                  textDecoration:'none', textAlign:'center',
                }}>
                Napisz do nas
              </a>
              <button onClick={() => setDelState('idle')} style={{
                background:'none', border:'none', cursor:'pointer',
                fontSize:10, color:'#8A9BB0', marginTop:8,
                WebkitTapHighlightColor:'transparent',
              }}>Anuluj</button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

/* ─── sub: Język ────────────────────────────────────────────────── */
function LanguageView({ onBack }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <SubHeader title="Język" onBack={onBack}/>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 18px 24px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[
            { code:'pl', label:'Polski', active:true },
            { code:'en', label:'English', active:false, soon:true },
          ].map(l => (
            <button key={l.code} disabled={l.soon} style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 14px', background:'#fff',
              border:`1px solid ${l.active ? '#5BB8F5' : '#EDF1F7'}`,
              borderRadius:10, width:'100%', cursor: l.soon ? 'default' : 'pointer',
              textAlign:'left', WebkitTapHighlightColor:'transparent',
              boxShadow: l.active ? '0 0 0 2px rgba(91,184,245,0.15)' : '0 1px 4px rgba(0,0,0,0.04)',
              opacity: l.soon ? 0.5 : 1,
            }}>
              <div style={{ flex:1 }}>
                <p style={{ fontSize:13, fontWeight:600, margin:0, color: l.active ? '#1A2840' : '#8A9BB0' }}>
                  {l.label}
                </p>
                {l.soon && <p style={{ fontSize:10, color:'#B0C0D4', margin:'2px 0 0' }}>Wkrótce</p>}
              </div>
              {l.active && (
                <div style={{
                  width:18, height:18, borderRadius:'50%',
                  background:'#5BB8F5', flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── sub: Informacje ───────────────────────────────────────────── */
function InfoView({ onBack }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <SubHeader title="Informacje" onBack={onBack}/>
      <div style={{ flex:1, overflowY:'auto', padding:'12px 18px 24px', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
          {[
            { label:'Polityka prywatności', href:'https://hoopconnect.pl/privacy' },
            { label:'Regulamin',            href:'https://hoopconnect.pl/terms'   },
            { label:'Kontakt',              href:'mailto:kontakt@hoopconnect.pl'  },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 14px', background:'#fff',
              border:'1px solid #EDF1F7', borderRadius:10,
              textDecoration:'none', WebkitTapHighlightColor:'transparent',
              boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <p style={{ flex:1, fontSize:13, fontWeight:600, color:'#1A2840', margin:0 }}>{l.label}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        <p style={{
          textAlign:'center', fontSize:9, letterSpacing:1.5, fontWeight:600,
          color:'#C8D4E0', textTransform:'uppercase', marginTop:32,
        }}>
          HoopConnect · {APP_VERSION}
        </p>
      </div>
    </div>
  )
}

/* ─── main ──────────────────────────────────────────────────────── */
export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut } = useAuth()
  const [view, setView] = useState('main')

  useEffect(() => { if (!open) setTimeout(() => setView('main'), 280) }, [open])

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pl-PL', { month:'long', year:'numeric' })
    : null

  async function handleSignOut() { onClose(); await signOut() }

  const isMain = view === 'main'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="sp-bd"
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            transition={{ duration:0.18 }}
            onClick={onClose}
            style={{
              position:'fixed', inset:0, zIndex:400,
              background:'rgba(4,8,16,0.55)',
              backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
            }}
          />

          <div style={{
            position:'fixed',
            top:20, bottom:20,
            left:'max(0px, calc((100vw - 430px) / 2))',
            width:'min(calc(min(100vw, 430px) * 0.78), 300px)',
            zIndex:401,
            overflow:'hidden',
            borderRadius:'0 16px 16px 0',
            pointerEvents:'none',
          }}>
            <motion.div key="sp-drawer"
              initial={{ x:'-100%' }} animate={{ x:0 }} exit={{ x:'-100%' }}
              transition={SLIDE}
              style={{
                position:'absolute', inset:0,
                background:'#F4F7FB',
                boxShadow:'8px 0 40px rgba(0,0,0,0.22)',
                display:'flex', flexDirection:'column',
                overflow:'hidden',
                pointerEvents:'all',
              }}
            >
              {/* ── ✕ zawsze w tym samym miejscu ─────────────── */}
              <CloseBtn onClose={onClose}/>

              {/* ── MAIN ──────────────────────────────────────── */}
              <motion.div
                animate={{ x: isMain ? 0 : '-100%' }}
                transition={SLIDE}
                style={{
                  position:'absolute', inset:0,
                  display:'flex', flexDirection:'column',
                  overflowY:'auto', WebkitOverflowScrolling:'touch',
                }}
              >
                <div style={{ height:14 }}/>

                {/* header */}
                <div style={{ padding:'10px 56px 0 18px' }}>
                  <p style={{
                    fontSize:11, fontWeight:700, letterSpacing:2.5,
                    textTransform:'uppercase', color:'#A0B0C8', margin:0,
                  }}>Ustawienia</p>
                </div>

                {/* profile card */}
                <div style={{ padding:'14px 18px 0' }}>
                  <div style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'13px', background:'#fff',
                    borderRadius:12, border:'1px solid #EDF1F7',
                    boxShadow:'0 1px 6px rgba(0,0,0,0.05)',
                  }}>
                    <div style={{ position:'relative', width:50, height:50, flexShrink:0 }}>
                      <HexFrameOnly size={50} variant={profile?.equipped_frame || 'default'}/>
                      <svg width={50} height={50} viewBox="0 0 90 90"
                        style={{ overflow:'visible', position:'relative', zIndex:1,
                          filter:'drop-shadow(0 3px 10px rgba(91,184,245,0.5))' }}>
                        <defs>
                          <linearGradient id="spAv" x1="20%" y1="0%" x2="80%" y2="100%">
                            <stop offset="0%"  stopColor="#7BC8F8"/>
                            <stop offset="100%" stopColor="#1B3A6B"/>
                          </linearGradient>
                        </defs>
                        <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.35)"/>
                        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#spAv)"/>
                        <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.22)"/>
                        <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.10)"/>
                        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                          fill="none" stroke="rgba(91,184,245,0.80)" strokeWidth="2.2" strokeLinejoin="round"/>
                        <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize="30" fontWeight="900"
                          fontFamily="var(--font-display),sans-serif">
                          {profile?.name?.[0]?.toUpperCase() || '?'}
                        </text>
                      </svg>
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:14, fontWeight:600, color:'#1A2840', margin:0,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {profile?.name || 'Gracz'}
                      </p>
                      <p style={{ fontSize:10.5, color:'#8A9BB0', margin:'2px 0 0',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {user?.email}
                      </p>
                      {memberSince && (
                        <p style={{ fontSize:9.5, color:'#5BB8F5', fontWeight:600, letterSpacing:0.5, margin:'4px 0 0' }}>
                          Beta · {memberSince}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* nav */}
                <div style={{ padding:'0 18px', flex:1 }}>
                  <SLabel>Ustawienia</SLabel>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    <NavRow label="Konto" sub="Profil · Plan · Email · Hasło" onClick={() => setView('account')}/>
                    <NavRow label="Język" sub="Polski" onClick={() => setView('language')}/>
                  </div>

                  <SLabel>Społeczność</SLabel>
                  <a href="https://discord.gg/wZrDcRea" target="_blank" rel="noopener noreferrer"
                    style={{
                      display:'flex', alignItems:'center', gap:12,
                      padding:'12px 14px', background:'#fff',
                      border:'1px solid #EDF1F7', borderRadius:10,
                      textDecoration:'none', WebkitTapHighlightColor:'transparent',
                      boxShadow:'0 1px 4px rgba(0,0,0,0.04)',
                    }}>
                    <span style={{
                      width:32, height:32, borderRadius:9, flexShrink:0,
                      background:'rgba(88,101,242,0.10)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                      </svg>
                    </span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, fontWeight:600, color:'#1A2840', margin:0 }}>Dołącz na Discord</p>
                      <p style={{ fontSize:10, color:'#8A9BB0', margin:'2px 0 0' }}>Społeczność HoopConnect</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </a>

                  <SLabel>Inne</SLabel>
                  <NavRow label="Informacje" sub="Polityka · Regulamin · Kontakt" onClick={() => setView('info')}/>
                </div>

                <div style={{ padding:'20px 18px 24px', textAlign:'center' }}>
                  <button onClick={handleSignOut} style={{
                    background:'none', border:'none', cursor:'pointer',
                    fontSize:12, fontWeight:600, color:'#C0392B',
                    WebkitTapHighlightColor:'transparent', padding:'4px 8px',
                  }}>Wyloguj się</button>
                  <p style={{
                    fontSize:8.5, letterSpacing:1.5, textTransform:'uppercase',
                    color:'#C8D4E0', fontWeight:600, margin:'10px 0 0',
                  }}>HoopConnect · {APP_VERSION}</p>
                </div>
              </motion.div>

              {/* ── SUB ───────────────────────────────────────── */}
              <motion.div
                animate={{ x: isMain ? '100%' : 0 }}
                transition={SLIDE}
                style={{
                  position:'absolute', inset:0,
                  background:'#F4F7FB',
                  display:'flex', flexDirection:'column',
                  pointerEvents: isMain ? 'none' : 'all',
                }}
              >
                {view === 'account'  && <AccountView  onBack={() => setView('main')} open={open} profile={profile} user={user}/>}
                {view === 'language' && <LanguageView onBack={() => setView('main')}/>}
                {view === 'info'     && <InfoView     onBack={() => setView('main')}/>}
              </motion.div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
