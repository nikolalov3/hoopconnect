import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import HexAvatar from './HexAvatar'

// ── Design tokens ─────────────────────────────────────────────────────────────
// Bardziej szary, przygaszone baby-blue ramki
const C = {
  bg:      '#0A0D13',
  surface: '#111520',
  card:    '#161C28',
  border:  'rgba(85,145,205,0.13)',
  borderT: 'rgba(85,145,205,0.22)',
  accent:  '#00CCFF',
  bb:      'rgba(85,145,205,0.18)',   // baby-blue tło dla aktywnych
  orange:  '#FFA820',
  text:    '#D8E6F4',
  sub:     'rgba(145,190,230,0.50)',
  dim:     'rgba(85,140,195,0.35)',
  red:     '#FF5060',
  green:   '#00E890',
}

const SLIDE = { type: 'tween', duration: 0.26, ease: [0.16, 1, 0.3, 1] }
const SHEET = { type: 'spring', stiffness: 340, damping: 38 }
const APP_VERSION = '1.2.1-beta'

const DAY_SHORT = ['Nd', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}

const ALL_FRAMES = [
  { id: 'none',         label: 'Brak'         },
  { id: 'early_access', label: 'Early Access' },
  { id: 'diamond_s1',   label: 'Diament S1'   },
  { id: 'saltearth',    label: 'Salt of the Earth' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function SLabel({ children, style }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 2.5,
      textTransform: 'uppercase', color: C.dim,
      margin: '22px 0 8px 2px', ...style,
    }}>{children}</p>
  )
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: '20px 0' }}/>
}

function Row({ label, sub, right, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '13px 16px',
      background: C.card,
      border: 'none', width: '100%',
      cursor: onClick ? 'pointer' : 'default',
      textAlign: 'left', WebkitTapHighlightColor: 'transparent',
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

/**
 * Section showing the teams (sformalizowane drużyny prowadzone przez trenera)
 * that this player is a member of. Hidden when the player has no teams.
 * Each card has a "Opuść drużynę" button that calls leave_team() RPC.
 */
function TeamsSection() {
  const [teams, setTeams] = useState(null)         // null = loading, [] = empty
  const [confirmTeamId, setConfirmTeamId] = useState(null)
  const [busyTeamId, setBusyTeamId] = useState(null)

  const load = async () => {
    const { data, error } = await supabase.rpc('get_my_teams')
    if (error) { setTeams([]); return }
    setTeams(data || [])
  }

  useEffect(() => { load() }, [])

  const leave = async (teamId) => {
    setBusyTeamId(teamId)
    const { error } = await supabase.rpc('leave_team', { p_team_id: teamId })
    setBusyTeamId(null)
    setConfirmTeamId(null)
    if (!error) await load()
  }

  if (teams === null) return null
  if (teams.length === 0) return null

  return (
    <>
      <SLabel>Drużyna</SLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {teams.map(t => {
          const isConfirming = confirmTeamId === t.team_id
          const isBusy = busyTeamId === t.team_id
          const sectionLabel = t.section === 'M' ? 'Męska' : t.section === 'K' ? 'Żeńska' : 'Mixed'
          return (
            <div key={t.team_id} style={{
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              borderTop: `1px solid ${C.borderT}`,
              background: C.card,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 16px 12px' }}>
                {t.organization && (
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.sub, margin: 0 }}>
                    {t.organization}
                  </p>
                )}
                <p style={{
                  fontSize: 16, fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: 0.4, textTransform: 'uppercase',
                  color: C.text, margin: '2px 0 4px',
                }}>
                  {t.team_name}
                </p>
                <p style={{ fontSize: 11, color: C.sub, margin: 0, letterSpacing: 0.3 }}>
                  {t.age_category} · {sectionLabel}
                  {t.jersey_number ? ` · #${t.jersey_number}` : ''}
                </p>
              </div>

              {isConfirming ? (
                <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 16px', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setConfirmTeamId(null)}
                    disabled={isBusy}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 9,
                      border: `1px solid ${C.border}`, background: 'transparent',
                      color: C.sub, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}
                  >Nie, zostaję</button>
                  <button
                    onClick={() => leave(t.team_id)}
                    disabled={isBusy}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 9,
                      border: `1px solid ${C.red}`, background: 'rgba(255,80,96,0.12)',
                      color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >{isBusy ? '...' : 'Tak, opuść drużynę'}</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmTeamId(t.team_id)}
                  style={{
                    width: '100%', borderTop: `1px solid ${C.border}`,
                    background: 'transparent', border: 'none',
                    padding: '11px 16px', cursor: 'pointer',
                    color: C.red, fontSize: 12, fontWeight: 600,
                    letterSpacing: 0.3, textAlign: 'center',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  Opuść drużynę
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

function CardGroup({ children }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: `1px solid ${C.border}`,
      borderTop: `1px solid ${C.borderT}`,
    }}>
      {items.map((child, i) => (
        <div key={i} style={{ borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}>
          {child}
        </div>
      ))}
    </div>
  )
}

function SubHeader({ title, onBack, onClose }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '16px 18px 12px',
      borderBottom: `1px solid ${C.border}`, flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        width: 30, height: 30, borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)', border: 'none',
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
        background: 'rgba(255,255,255,0.05)', border: 'none',
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

function Field({ label, value, onChange, placeholder = '' }) {
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
        value={value}
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

// ── Week picker ───────────────────────────────────────────────────────────────
function WeekPicker({ trainingDays }) {
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
  ), [maxDays])
  const [selected, setSelected] = useState(initSelected)
  const [showWarn, setShowWarn] = useState(false)

  useEffect(() => { setSelected(initSelected); setShowWarn(false) }, [maxDays])

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
                ? `1.5px solid ${isSel ? C.orange : 'rgba(255,168,32,0.35)'}`
                : `1.5px solid ${isSel ? C.border : C.border}`,
              background: isSel
                ? isToday ? 'rgba(255,168,32,0.14)' : C.bb
                : 'rgba(255,255,255,0.02)',
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

// ── Frame picker ──────────────────────────────────────────────────────────────
function FramePicker({ current, uid, profile, onPick }) {
  const unlocked = useMemo(() => {
    const frames = new Set(['none'])
    if (uid && localStorage.getItem(`hc_frame_seen_early_access_${uid}`)) frames.add('early_access')
    if (uid && localStorage.getItem(`hc_frame_seen_diamond_s1_${uid}`))   frames.add('diamond_s1')
    // Ramka właściciela — widoczna tylko dla konta deweloperskiego
    if (profile?.username === 'nikolalovexo@gmail.com') frames.add('saltearth')
    return frames
  }, [uid, profile?.username])

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {ALL_FRAMES.filter(f => unlocked.has(f.id)).map(f => {
        const active = (current || 'none') === f.id
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
              background: active ? C.bb : 'rgba(255,255,255,0.025)',
              border: active ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              <HexAvatar name={profile?.name} variant={f.id} size={48} noAnim/>
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

// ── Spin picker: value +/− z zakresem ────────────────────────────────────────
function SpinPicker({ label, value, onChange, min, max, unit = '' }) {
  return (
    <div style={{
      flex: 1, background: C.card,
      border: `1px solid ${C.border}`, borderTop: `1px solid ${C.borderT}`,
      borderRadius: 12, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
        textTransform: 'uppercase', color: C.dim, margin: 0 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
          color: C.sub, fontSize: 16, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>−</button>
        <p style={{
          fontSize: 20, fontWeight: 900, color: C.text, margin: 0,
          fontFamily: 'var(--font-display)', minWidth: 52, textAlign: 'center',
        }}>{value || '—'}</p>
        <button onClick={() => onChange(Math.min(max, value + 1))} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
          color: C.sub, fontSize: 16, lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}>+</button>
      </div>
      {unit && <p style={{ fontSize: 9, color: C.dim, margin: 0, letterSpacing: 0.5 }}>{unit}</p>}
    </div>
  )
}

// ── Sub-view: Edytuj profil ───────────────────────────────────────────────────
// Zawiera: dane profilowe + dane fizyczne + plan tygodnia + ramka avatara
function EditProfileView({ onBack, onClose, profile, user, onProfileSaved, onFrameChange }) {
  const uid = user?.id
  const currentYear = new Date().getFullYear()
  const [name,       setName]       = useState(profile?.name || '')
  const [city,       setCity]       = useState(profile?.city || '')
  const [birthYear,  setBirthYear]  = useState(
    profile?.birth_year || (profile?.age ? currentYear - profile.age : 0)
  )
  const [heightCm,   setHeightCm]   = useState(profile?.height_cm || 0)
  const [days,       setDays]       = useState(() => {
    const cached = uid ? +localStorage.getItem(`hc_tdays_${uid}`) : 0
    return cached || profile?.training_days || 4
  })
  const [saveState,  setSaveState]  = useState('idle')
  const [frameId,    setFrameId]    = useState(profile?.equipped_frame || 'none')
  const [frameState, setFrameState] = useState('idle')

  const dirty = name.trim() !== (profile?.name || '').trim()
    || city.trim() !== (profile?.city || '').trim()
    || days !== (profile?.training_days || 4)
    || birthYear !== (profile?.birth_year || (profile?.age ? currentYear - profile.age : 0))
    || heightCm  !== (profile?.height_cm  || 0)

  async function handleSave() {
    setSaveState('saving')
    try {
      const { error } = await supabase.from('profiles').update({
        name:          name.trim(),
        city:          city.trim() || null,
        training_days: days,
        birth_year:    birthYear || null,
        height_cm:     heightCm  || null,
        // przelicz age żeby pozostał spójny
        ...(birthYear && { age: currentYear - birthYear }),
      }).eq('id', uid)
      if (error) throw error
      if (uid) localStorage.setItem(`hc_tdays_${uid}`, String(days))
      setSaveState('saved')
      onProfileSaved?.()
      setTimeout(() => setSaveState('idle'), 2000)
    } catch (e) {
      console.error('[EditProfileView] handleSave:', e)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    }
  }

  async function handlePickFrame(id) {
    if (frameState === 'saving') return
    const equipped = id === 'none' ? null : id
    setFrameId(id)
    onFrameChange?.(equipped)
    setFrameState('saving')
    try {
      const { error } = await supabase.from('profiles')
        .update({ equipped_frame: equipped })
        .eq('id', uid)
        .select('equipped_frame')
      if (error) throw error
      setFrameState('saved')
      setTimeout(() => setFrameState('idle'), 1400)
    } catch (e) {
      console.error('[EditProfileView] handlePickFrame:', e)
      setFrameId(profile?.equipped_frame || 'none')
      onFrameChange?.(profile?.equipped_frame ?? null)
      setFrameState('error')
      setTimeout(() => setFrameState('idle'), 2000)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="Edytuj profil" onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 18px 40px' }}>

        {/* ── Dane profilowe ── */}
        <SLabel>Dane profilowe</SLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Imię / Nazwa" value={name} onChange={setName} placeholder="Twoja nazwa"/>
          <Field label="Miasto" value={city} onChange={setCity} placeholder="np. Warszawa"/>
        </div>

        {/* ── Dane fizyczne ── */}
        <Divider/>
        <SLabel style={{ margin: '0 0 12px 2px' }}>Dane fizyczne</SLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <SpinPicker
            label="Rok urodzenia"
            value={birthYear}
            onChange={setBirthYear}
            min={currentYear - 60}
            max={currentYear - 10}
          />
          <SpinPicker
            label="Wzrost"
            value={heightCm}
            onChange={setHeightCm}
            min={140}
            max={230}
            unit="cm"
          />
        </div>

        {/* ── Plan tygodnia ── */}
        <Divider/>
        <SLabel style={{ margin: '0 0 12px 2px' }}>Plan tygodnia</SLabel>

        {/* Wybór liczby dni */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[3, 4, 5, 6].map(n => (
            <button key={n} onClick={() => setDays(n)} style={{
              flex: 1, padding: '11px 0',
              background: days === n ? C.bb : 'rgba(255,255,255,0.025)',
              border: `1.5px solid ${days === n ? C.accent + '70' : C.border}`,
              borderRadius: 10, cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent', transition: 'all 0.15s',
            }}>
              <p style={{ fontSize: 19, fontWeight: 900, margin: 0,
                color: days === n ? C.accent : C.sub,
                fontFamily: 'var(--font-display)' }}>{n}</p>
              <p style={{ fontSize: 8, color: C.dim, margin: '1px 0 0', letterSpacing: 0.5 }}>dni</p>
            </button>
          ))}
        </div>

        {/* WeekPicker */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
          color: C.dim, margin: '0 0 8px 2px' }}>Ten tydzień</p>
        <WeekPicker trainingDays={days}/>

        {/* Przycisk zapisz (profil + plan) */}
        <AnimatePresence>
          {(dirty || saveState !== 'idle') && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 14 }}>
              <PrimaryBtn
                label={
                  saveState === 'saved'  ? '✓ Zapisano' :
                  saveState === 'error'  ? 'Błąd — spróbuj ponownie' :
                  saveState === 'saving' ? 'Zapisywanie…' : 'Zapisz zmiany'
                }
                onClick={handleSave}
                disabled={saveState === 'saving'}
                state={saveState}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Ramka avatara ── */}
        <Divider/>
        <div style={{ display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12 }}>
          <SLabel style={{ margin: 0 }}>Ramka avatara</SLabel>
          <AnimatePresence>
            {frameState !== 'idle' && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 10, fontWeight: 700, margin: 0,
                  color: frameState === 'error' ? C.red
                       : frameState === 'saving' ? C.dim : C.green }}>
                {frameState === 'error' ? '✗ Błąd' : frameState === 'saving' ? '…' : '✓ Zmieniono'}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <FramePicker current={frameId} uid={uid} profile={profile} onPick={handlePickFrame}/>

        {/* ── Drużyny (zarządzanie członkostwem) ── */}
        <Divider/>
        <TeamsSection/>

      </div>
    </div>
  )
}

// ── Sub-view: Konto ───────────────────────────────────────────────────────────
function AccountView({ onBack, onClose, user }) {
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
                  stroke={user?.email_confirmed_at ? C.green : C.red}
                  strokeWidth="3" strokeLinecap="round">
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
            label={pwState === 'sent' ? '✓ Link wysłany' : pwState === 'error' ? 'Błąd — spróbuj ponownie' : 'Zmień hasło'}
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
            background: 'rgba(255,80,96,0.06)', border: `1px solid rgba(255,80,96,0.18)`,
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

// ── Discord card (featured, tuż pod profilem) ─────────────────────────────────
function DiscordCard() {
  return (
    <a href="https://discord.gg/7TwhZAvEzb" target="_blank" rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}>
      <motion.div whileTap={{ scale: 0.985 }} style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '13px 16px',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderTop: `1px solid ${C.borderT}`,
        borderRadius: 16,
      }}>
        {/* Icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: 'rgba(88,101,242,0.12)',
          border: '1px solid rgba(88,101,242,0.20)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#7289DA">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>
            Dołącz na Discord
          </p>
          <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>
            Społeczność HoopConnect
          </p>
        </div>
        {/* Arrow */}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={C.dim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </motion.div>
    </a>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut, refreshProfile, setProfileData } = useAuth()
  const [view, setView] = useState('main')

  useEffect(() => {
    if (!open) setTimeout(() => setView('main'), 300)
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
              background: 'rgba(4,8,15,0.75)',
              backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            }}
          />

          {/* Sheet */}
          <motion.div key="sp-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={SHEET}
            style={{
              position: 'fixed', bottom: 0,
              left: 'max(0px, calc((100vw - 430px) / 2))',
              width: 'min(100vw, 430px)',
              height: '92%', zIndex: 501,
              borderRadius: '20px 20px 0 0',
              background: C.bg,
              boxShadow: '0 -8px 60px rgba(0,0,0,0.65)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>

            {/* Drag handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.12)',
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

              {/* Profile hero */}
              <div style={{ padding: '16px 18px 0' }}>
                <div style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderTop: `1px solid ${C.borderT}`,
                  borderRadius: 18, padding: '18px 16px',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <div style={{ flexShrink: 0 }}>
                    <HexAvatar name={profile?.name} variant={profile?.equipped_frame || 'none'} size={70}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0,
                      fontFamily: 'var(--font-display)', letterSpacing: 0.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile?.name || 'Gracz'}
                    </p>
                    <p style={{ fontSize: 10, color: C.sub, margin: '3px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email}
                    </p>
                    {memberSince && (
                      <p style={{ fontSize: 9, color: C.accent, fontWeight: 600,
                        letterSpacing: 0.5, margin: '5px 0 0' }}>
                        Beta · {memberSince}
                      </p>
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.93 }}
                    onClick={() => setView('editProfile')}
                    style={{
                      flexShrink: 0, padding: '7px 14px',
                      background: C.bb,
                      border: `1px solid ${C.border}`,
                      borderTop: `1px solid ${C.borderT}`,
                      borderRadius: 8, cursor: 'pointer',
                      WebkitTapHighlightColor: 'transparent',
                    }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.accent,
                      margin: 0, letterSpacing: 0.5 }}>Edytuj</p>
                  </motion.button>
                </div>
              </div>

              {/* Discord — tuż pod profilem */}
              <div style={{ padding: '10px 18px 0' }}>
                <DiscordCard/>
              </div>

              {/* Sekcje */}
              <div style={{ padding: '0 18px', flex: 1 }}>

                <SLabel>Konto</SLabel>
                <CardGroup>
                  <Row label="Ustawienia konta" sub="Email · Hasło · Usuń konto" onClick={() => setView('account')}/>
                  <Row label="Język" sub="Polski" onClick={() => setView('language')}/>
                </CardGroup>

                <SLabel>Inne</SLabel>
                <CardGroup>
                  <Row label="Informacje" sub="Polityka · Regulamin · Kontakt" onClick={() => setView('info')}/>
                </CardGroup>

              </div>

              {/* Sign out */}
              <div style={{ padding: '24px 18px 44px', textAlign: 'center' }}>
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
                  onFrameChange={frame => setProfileData({ equipped_frame: frame })}
                />
              )}
              {view === 'account' && (
                <AccountView onBack={() => setView('main')} onClose={onClose} user={user}/>
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

          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
