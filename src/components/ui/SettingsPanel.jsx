import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import HexAvatar from './HexAvatar'

// ── Design tokens (dark theme, matching app) ──────────────────────────────────
const C = {
  bg:      '#04080F',
  surface: '#08111E',
  card:    '#0C1828',
  border:  'rgba(255,255,255,0.07)',
  borderT: 'rgba(255,255,255,0.12)',
  accent:  '#00CCFF',
  orange:  '#FFA820',
  text:    '#E0EEFF',
  sub:     'rgba(180,210,240,0.45)',
  dim:     'rgba(120,160,200,0.30)',
  red:     '#FF5060',
  green:   '#00E890',
}

const SLIDE = { type: 'tween', duration: 0.26, ease: [0.16, 1, 0.3, 1] }
const SHEET = { type: 'spring', stiffness: 340, damping: 38 }
const APP_VERSION = '1.2.0-beta'

const DAY_SHORT = ['Nd', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}

// All available frames — id matches HexAvatar variant, label shown in picker
// id:'none' = brak ramki (wariant 'none' → src: null w HexAvatar)
const ALL_FRAMES = [
  { id: 'none',         label: 'Brak'          },
  { id: 'early_access', label: 'Early Access'  },
  { id: 'diamond_s1',   label: 'Diament S1'    },
]

// ── Section label ─────────────────────────────────────────────────────────────
function SLabel({ children, style }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 2.5,
      textTransform: 'uppercase', color: C.dim,
      margin: '22px 0 8px 2px', ...style,
    }}>{children}</p>
  )
}

// ── Card row ──────────────────────────────────────────────────────────────────
function Row({ label, sub, right, onClick, danger, noBorder }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      background: C.card,
      border: `1px solid ${C.border}`,
      borderTop: `1px solid ${C.borderT}`,
      borderRadius: 0,
      width: '100%', cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left', WebkitTapHighlightColor: 'transparent',
      ...(noBorder && { border: 'none', borderTop: 'none' }),
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0,
          color: danger ? C.red : C.text }}>{label}</p>
        {sub && <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>{sub}</p>}
      </div>
      {right ?? (onClick && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      ))}
    </button>
  )
}

// ── Card group (rounded corners on first/last) ────────────────────────────────
function CardGroup({ children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${C.border}`, borderTop: `1px solid ${C.borderT}` }}>
      {items.map((child, i) => (
        <div key={i} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
          {child}
        </div>
      ))}
    </div>
  )
}

// ── Sub-view header ───────────────────────────────────────────────────────────
function SubHeader({ title, onBack, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '16px 18px 12px',
      borderBottom: `1px solid ${C.border}`, flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent', flexShrink: 0,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          stroke={C.sub} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <p style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: 2,
        textTransform: 'uppercase', color: C.sub, margin: 0 }}>{title}</p>
      <button onClick={onClose} style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
          stroke={C.sub} strokeWidth="2.8" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

// ── Input field ───────────────────────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderTop: `1px solid ${C.borderT}`,
      borderRadius: 12, padding: '10px 14px',
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
        textTransform: 'uppercase', color: C.dim, margin: '0 0 5px' }}>{label}</p>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', border: 'none', outline: 'none',
          fontSize: 14, fontWeight: 500, color: C.text,
          background: 'transparent', padding: 0,
          fontFamily: 'var(--font-body)',
        }}
      />
    </div>
  )
}

// ── Primary button ────────────────────────────────────────────────────────────
function PrimaryBtn({ label, onClick, disabled, state }) {
  const bg = state === 'saved' ? C.green : state === 'error' ? C.red : C.accent
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '14px',
        background: `linear-gradient(135deg, ${bg}, ${bg}cc)`,
        border: 'none', borderRadius: 12, cursor: 'pointer',
        fontSize: 12, fontWeight: 800, color: '#000',
        letterSpacing: 1.5, textTransform: 'uppercase',
        WebkitTapHighlightColor: 'transparent',
        opacity: disabled ? 0.6 : 1, transition: 'background 0.2s',
        fontFamily: 'var(--font-display)',
      }}>{label}</motion.button>
  )
}

// ── Frame picker ──────────────────────────────────────────────────────────────
function FramePicker({ current, uid, profile, onPick }) {
  // 'none' is always available; other frames require localStorage unlock flag
  const unlocked = useMemo(() => {
    const frames = new Set(['none'])
    if (uid && localStorage.getItem(`hc_frame_seen_early_access_${uid}`))
      frames.add('early_access')
    if (uid && localStorage.getItem(`hc_frame_seen_diamond_s1_${uid}`))
      frames.add('diamond_s1')
    return frames
  }, [uid])

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingBottom: 4 }}>
      {ALL_FRAMES.filter(f => unlocked.has(f.id)).map(f => {
        // equipped_frame: null / undefined → 'none' is active
        const equippedVariant = current || 'none'
        const active = equippedVariant === f.id
        return (
          <motion.button key={f.id} whileTap={{ scale: 0.93 }}
            onClick={() => onPick(f.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, WebkitTapHighlightColor: 'transparent',
            }}>
            <div style={{
              width: 68, height: 68, borderRadius: 10,
              background: active ? `rgba(0,204,255,0.10)` : 'rgba(255,255,255,0.03)',
              border: active ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'border-color 0.15s',
            }}>
              <HexAvatar
                name={profile?.name}
                variant={f.id}
                size={48}
                noAnim
              />
            </div>
            <p style={{
              fontSize: 9, fontWeight: active ? 800 : 500, letterSpacing: 0.5,
              color: active ? C.accent : C.sub, margin: 0, textAlign: 'center',
            }}>{f.label}</p>
          </motion.button>
        )
      })}
    </div>
  )
}

// ── Week picker ───────────────────────────────────────────────────────────────
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
      if (next.has(i)) next.delete(i)
      else if (next.size >= maxDays) { setShowWarn(true); return prev }
      else next.add(i)
      return next
    })
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 5 }}>
        {days.map((d, i) => {
          const isToday = i === 0; const isSel = selected.has(i)
          return (
            <button key={i} onClick={() => toggle(i)} style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '10px 0 8px', borderRadius: 10,
              border: isToday
                ? `1.5px solid ${isSel ? C.orange : 'rgba(255,168,32,0.40)' }`
                : `1.5px solid ${isSel ? C.accent + '80' : C.border}`,
              background: isSel
                ? isToday ? 'rgba(255,168,32,0.18)' : 'rgba(0,204,255,0.12)'
                : 'rgba(255,255,255,0.025)',
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                lineHeight: 1, color: isSel ? C.text : C.sub }}>{d.getDate()}</span>
              <span style={{ fontSize: 7.5, fontWeight: 600, letterSpacing: 0.5,
                textTransform: 'uppercase', lineHeight: 1,
                color: isSel ? C.sub : C.dim }}>
                {DAY_SHORT[d.getDay()]}
              </span>
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {showWarn && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: 10, color: C.orange, fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
            Limit {maxDays} dni — odznacz dzień żeby zmienić inny.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-view: Edytuj profil ───────────────────────────────────────────────────
function EditProfileView({ onBack, onClose, profile, user, onProfileSaved }) {
  const [name,       setName]       = useState(profile?.name || '')
  const [city,       setCity]       = useState(profile?.city || '')
  const [saveState,  setSaveState]  = useState('idle')
  const [frameId,    setFrameId]    = useState(profile?.equipped_frame || 'none')
  const [frameSaved, setFrameSaved] = useState(false)

  const dirty = name.trim() !== (profile?.name || '').trim()
    || city.trim() !== (profile?.city || '').trim()

  async function handleSave() {
    setSaveState('saving')
    try {
      const { error } = await supabase.from('profiles').update({
        name: name.trim(),
        city: city.trim() || null,
        equipped_frame: frameId === 'none' ? null : frameId,
      }).eq('id', user.id)
      if (error) throw error
      setSaveState('saved')
      onProfileSaved?.()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch { setSaveState('error'); setTimeout(() => setSaveState('idle'), 2000) }
  }

  async function handlePickFrame(id) {
    setFrameId(id)
    await supabase.from('profiles')
      .update({ equipped_frame: id === 'none' ? null : id })
      .eq('id', user.id)
    onProfileSaved?.()
    setFrameSaved(true)
    setTimeout(() => setFrameSaved(false), 1600)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="Edytuj profil" onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 18px 36px' }}>

        <SLabel>Dane profilowe</SLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Imię / Nazwa" value={name} onChange={setName} placeholder="Twoja nazwa"/>
          <Field label="Miasto" value={city} onChange={setCity} placeholder="np. Warszawa"/>
        </div>

        <AnimatePresence>
          {(dirty || saveState !== 'idle') && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 12 }}>
              <PrimaryBtn
                label={saveState === 'saved' ? '✓ Zapisano' : saveState === 'error' ? 'Błąd — spróbuj ponownie' : saveState === 'saving' ? 'Zapisywanie…' : 'Zapisz zmiany'}
                onClick={handleSave}
                disabled={saveState === 'saving'}
                state={saveState}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
          <SLabel style={{ margin: 0 }}>Ramka avatara</SLabel>
          <AnimatePresence>
            {frameSaved && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 10, color: C.green, fontWeight: 700, margin: 0 }}>
                ✓ Zmieniono
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <FramePicker current={frameId} uid={user?.id} profile={profile} onPick={handlePickFrame}/>

      </div>
    </div>
  )
}

// ── Mini-sheet: Plan tygodnia ─────────────────────────────────────────────────
// Wysuwa się z dołu WEWNĄTRZ panelu ustawień (position:absolute, bottom:0).
function TrainingMiniSheet({ open, onClose, profile, user, onProfileSaved }) {
  const uid = user?.id
  // Inicjalizuj z localStorage (instant) → nadpisz profilem z DB gdy dostępny
  const [days, setDays] = useState(() => {
    const cached = uid ? +localStorage.getItem(`hc_tdays_${uid}`) : 0
    return cached || profile?.training_days || 4
  })
  const [saveState, setSaveState] = useState('idle')

  useEffect(() => {
    if (open && profile?.training_days) setDays(profile.training_days)
  }, [open])

  async function handleSaveDays() {
    setSaveState('saving')
    try {
      const { error } = await supabase.from('profiles')
        .update({ training_days: days }).eq('id', user.id)
      if (error) throw error
      if (uid) localStorage.setItem(`hc_tdays_${uid}`, String(days))
      setSaveState('saved')
      onProfileSaved?.()
      setTimeout(() => { setSaveState('idle'); onClose() }, 1000)
    } catch { setSaveState('error'); setTimeout(() => setSaveState('idle'), 2000) }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Półprzezroczysty overlay na treść panelu */}
          <motion.div
            key="tr-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0, zIndex: 9,
              background: 'rgba(4,8,15,0.55)',
            }}
          />
          {/* Mini-sheet */}
          <motion.div
            key="tr-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={SHEET}
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
              background: C.surface,
              borderRadius: '18px 18px 0 0',
              borderTop: `1px solid ${C.borderT}`,
              padding: '0 18px 48px',
              overflowY: 'auto', WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Handle */}
            <div style={{
              width: 32, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.14)',
              margin: '10px auto 18px',
            }}/>

            {/* Nagłówek */}
            <div style={{ display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 18 }}>
              <p style={{
                fontSize: 11, fontWeight: 800, letterSpacing: 2,
                textTransform: 'uppercase', color: C.sub, margin: 0,
              }}>Plan tygodnia</p>
              <button onClick={onClose} style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke={C.sub} strokeWidth="2.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Wybór liczby dni */}
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px' }}>
              Dni w tygodniu
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => setDays(n)} style={{
                  flex: 1, padding: '12px 0',
                  background: days === n ? 'rgba(0,204,255,0.12)' : 'rgba(255,255,255,0.025)',
                  border: `1.5px solid ${days === n ? C.accent + '80' : C.border}`,
                  borderRadius: 10, cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'all 0.15s',
                }}>
                  <p style={{ fontSize: 20, fontWeight: 900, margin: 0,
                    color: days === n ? C.accent : C.sub,
                    fontFamily: 'var(--font-display)' }}>{n}</p>
                  <p style={{ fontSize: 8, color: C.dim, margin: '2px 0 0',
                    letterSpacing: 0.5 }}>dni</p>
                </button>
              ))}
            </div>

            {/* WeekPicker */}
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px' }}>
              Ten tydzień
            </p>
            <WeekPicker trainingDays={days} open={open}/>

            {/* Zapisz — tylko gdy zmieniono */}
            <AnimatePresence>
              {days !== (profile?.training_days || 4) && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{ marginTop: 16 }}>
                  <PrimaryBtn
                    label={saveState === 'saved' ? '✓ Zapisano' : saveState === 'saving' ? 'Zapisywanie…' : 'Zapisz'}
                    onClick={handleSaveDays}
                    disabled={saveState === 'saving'}
                    state={saveState}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Sub-view: Konto ───────────────────────────────────────────────────────────
function AccountView({ onBack, onClose, profile, user }) {
  const [pwState,  setPwState]  = useState('idle')
  const [delState, setDelState] = useState('idle')

  async function handlePasswordReset() {
    setPwState('sending')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      })
      setPwState(error ? 'error' : 'sent')
    } catch { setPwState('error') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="Konto" onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 18px 36px' }}>

        <SLabel>Email</SLabel>
        <CardGroup>
          <Row
            label={user?.email_confirmed_at ? 'Email potwierdzony' : 'Email niepotwierdzony'}
            sub={user?.email}
            right={
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: user?.email_confirmed_at ? 'rgba(0,232,144,0.15)' : 'rgba(255,80,96,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke={user?.email_confirmed_at ? C.green : C.red} strokeWidth="3" strokeLinecap="round">
                  {user?.email_confirmed_at
                    ? <polyline points="20 6 9 17 4 12"/>
                    : <><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
                </svg>
              </div>
            }
          />
        </CardGroup>

        <SLabel>Hasło</SLabel>
        <CardGroup>
          <Row
            label={pwState === 'sent' ? '✓ Link wysłany na email' : pwState === 'error' ? 'Błąd — spróbuj ponownie' : 'Zmień hasło'}
            sub={pwState === 'idle' ? 'Link resetujący wysyłamy na Twój email' : undefined}
            onClick={pwState === 'idle' ? handlePasswordReset : undefined}
          />
        </CardGroup>

        <SLabel>Usuń konto</SLabel>
        {delState === 'idle' ? (
          <CardGroup>
            <Row label="Usuń konto" danger onClick={() => setDelState('confirm')}/>
          </CardGroup>
        ) : (
          <div style={{
            background: 'rgba(255,80,96,0.06)',
            border: `1px solid rgba(255,80,96,0.18)`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.red, margin: '0 0 4px' }}>Czy na pewno?</p>
            <p style={{ fontSize: 10.5, color: C.sub, margin: '0 0 14px', lineHeight: 1.5 }}>
              Tej akcji nie można cofnąć. Skontaktuj się z nami.
            </p>
            <a href="mailto:kontakt@hoopconnect.pl?subject=Usunięcie konta" style={{
              display: 'block', padding: '10px', background: C.red,
              borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff',
              textDecoration: 'none', textAlign: 'center',
            }}>Napisz do nas</a>
            <button onClick={() => setDelState('idle')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, color: C.sub, marginTop: 10, width: '100%',
              WebkitTapHighlightColor: 'transparent',
            }}>Anuluj</button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-view: Informacje ──────────────────────────────────────────────────────
function InfoView({ onBack, onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="Informacje" onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 36px' }}>
        <SLabel>Dokumenty</SLabel>
        <CardGroup>
          {[
            { label: 'Polityka prywatności', href: 'https://hoopconnect.pl/privacy' },
            { label: 'Regulamin',            href: 'https://hoopconnect.pl/terms'   },
            { label: 'Kontakt',              href: 'mailto:kontakt@hoopconnect.pl'  },
          ].map(l => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{l.label}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </a>
          ))}
        </CardGroup>
        <p style={{ textAlign: 'center', fontSize: 9, letterSpacing: 1.5, fontWeight: 600,
          color: C.dim, textTransform: 'uppercase', marginTop: 36 }}>
          HoopConnect · {APP_VERSION}
        </p>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const [view,         setView]         = useState('main')
  const [trainingOpen, setTrainingOpen] = useState(false)

  useEffect(() => {
    if (!open) setTimeout(() => { setView('main'); setTrainingOpen(false) }, 300)
  }, [open])

  async function handleSignOut() { onClose(); await signOut() }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    : null

  const isMain = view === 'main'

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div key="sp-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(4,8,15,0.72)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Sheet */}
          <motion.div key="sp-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={SHEET}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 'max(0px, calc((100vw - 430px) / 2))',
              width: 'min(100vw, 430px)',
              height: '92%',
              zIndex: 501,
              borderRadius: '20px 20px 0 0',
              background: C.bg,
              boxShadow: '0 -8px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>

            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.14)',
              margin: '12px auto 0', flexShrink: 0,
            }}/>

            {/* ── MAIN VIEW ── */}
            <motion.div
              animate={{ x: isMain ? 0 : '-100%' }}
              transition={SLIDE}
              style={{
                position: 'absolute', inset: 0, top: 20,
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              }}>

              {/* ── Profile hero ── */}
              <div style={{ padding: '16px 22px 0' }}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderTop: `1px solid ${C.borderT}`,
                  borderRadius: 18, padding: '18px 16px',
                  display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  {/* Avatar */}
                  <div style={{ flexShrink: 0 }}>
                    <HexAvatar
                      name={profile?.name}
                      variant={profile?.equipped_frame || 'none'}
                      size={72}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0,
                      fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile?.name || 'Gracz'}
                    </p>
                    <p style={{ fontSize: 10.5, color: C.sub, margin: '3px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email}
                    </p>
                    {memberSince && (
                      <p style={{ fontSize: 9.5, color: C.accent, fontWeight: 600,
                        letterSpacing: 0.5, margin: '5px 0 0' }}>
                        Beta · {memberSince}
                      </p>
                    )}
                  </div>

                  {/* Edit button */}
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => setView('editProfile')}
                    style={{
                      flexShrink: 0, padding: '7px 14px',
                      background: 'rgba(0,204,255,0.10)',
                      border: `1px solid ${C.accent}30`,
                      borderTop: `1px solid ${C.accent}50`,
                      borderRadius: 8, cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.accent,
                      margin: 0, letterSpacing: 0.5 }}>Edytuj</p>
                  </motion.button>
                </div>
              </div>

              {/* ── Sections ── */}
              <div style={{ padding: '0 22px', flex: 1 }}>

                <SLabel>Trening</SLabel>
                <CardGroup>
                  <Row
                    label="Plan tygodnia"
                    sub={`${profile?.training_days || 4} dni treningowych`}
                    onClick={() => setTrainingOpen(true)}
                  />
                </CardGroup>

                <SLabel>Konto</SLabel>
                <CardGroup>
                  <Row label="Ustawienia konta" sub="Email · Hasło · Usuń konto" onClick={() => setView('account')}/>
                  <Row label="Język" sub="Polski" onClick={() => setView('language')}/>
                </CardGroup>

                <SLabel>Społeczność</SLabel>
                <a href="https://discord.gg/wZrDcRea" target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '13px 16px',
                    background: C.card,
                    border: `1px solid ${C.border}`,
                    borderTop: `1px solid ${C.borderT}`,
                    borderRadius: 12,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(88,101,242,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>Dołącz na Discord</p>
                      <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>Społeczność HoopConnect</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </a>

                <SLabel>Inne</SLabel>
                <CardGroup>
                  <Row label="Informacje" sub="Polityka · Regulamin · Kontakt" onClick={() => setView('info')}/>
                </CardGroup>

              </div>

              {/* Sign out + version */}
              <div style={{ padding: '24px 22px 40px', textAlign: 'center' }}>
                <button onClick={handleSignOut} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, color: C.red,
                  WebkitTapHighlightColor: 'transparent', padding: '6px 16px',
                }}>Wyloguj się</button>
                <p style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: C.dim, fontWeight: 600, margin: '10px 0 0' }}>
                  HoopConnect · {APP_VERSION}
                </p>
              </div>

            </motion.div>

            {/* ── SUB VIEWS ── */}
            <motion.div
              animate={{ x: isMain ? '100%' : 0 }}
              transition={SLIDE}
              style={{
                position: 'absolute', inset: 0, top: 20,
                background: C.bg,
                display: 'flex', flexDirection: 'column',
                pointerEvents: isMain ? 'none' : 'all',
              }}>
              {view === 'editProfile' && (
                <EditProfileView
                  onBack={() => setView('main')} onClose={onClose}
                  profile={profile} user={user}
                  onProfileSaved={refreshProfile}
                />
              )}
              {view === 'account' && (
                <AccountView
                  onBack={() => setView('main')} onClose={onClose}
                  profile={profile} user={user}
                />
              )}
              {view === 'language' && (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <SubHeader title="Język" onBack={() => setView('main')} onClose={onClose}/>
                  <div style={{ padding: '0 18px' }}>
                    <SLabel>Dostępne języki</SLabel>
                    <CardGroup>
                      <Row label="Polski" right={
                        <div style={{ width: 18, height: 18, borderRadius: '50%',
                          background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="#000" strokeWidth="3" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      }/>
                      <Row label="English" sub="Wkrótce"/>
                    </CardGroup>
                  </div>
                </div>
              )}
              {view === 'info' && (
                <InfoView onBack={() => setView('main')} onClose={onClose}/>
              )}
            </motion.div>

            {/* ── TRAINING MINI-SHEET ── */}
            <TrainingMiniSheet
              open={trainingOpen}
              onClose={() => setTrainingOpen(false)}
              profile={profile} user={user}
              onProfileSaved={refreshProfile}
            />

          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
