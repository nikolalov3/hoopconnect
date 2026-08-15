import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import HexAvatar from './HexAvatar'
import PlayerCard3D from './PlayerCard3D'
import { useCardStats } from '../../hooks/useCardStats'
import { FRAME_CATALOG, frameSeenKey } from '../../lib/frames'
import { useBackgroundCatalog, backgroundAsset, useOwnedBackgrounds, redeemCode } from '../../lib/cardCatalog'

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
const APP_VERSION = '1.3.33'

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}

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
  const { t } = useTranslation('settings')
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
      <SLabel>{t('team.label')}</SLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {teams.map(tm => {
          const isConfirming = confirmTeamId === tm.team_id
          const isBusy = busyTeamId === tm.team_id
          const sectionLabel = tm.section === 'M' ? t('team.sectionM') : tm.section === 'K' ? t('team.sectionK') : t('team.sectionMixed')
          return (
            <div key={tm.team_id} style={{
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              borderTop: `1px solid ${C.borderT}`,
              background: C.card,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 16px 12px' }}>
                {tm.organization && (
                  <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', color: C.sub, margin: 0 }}>
                    {tm.organization}
                  </p>
                )}
                <p style={{
                  fontSize: 16, fontWeight: 800,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: 0.4, textTransform: 'uppercase',
                  color: C.text, margin: '2px 0 4px',
                }}>
                  {tm.team_name}
                </p>
                <p style={{ fontSize: 11, color: C.sub, margin: 0, letterSpacing: 0.3 }}>
                  {tm.age_category} · {sectionLabel}
                  {tm.jersey_number ? ` · #${tm.jersey_number}` : ''}
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
                  >{t('team.stayConfirm')}</button>
                  <button
                    onClick={() => leave(tm.team_id)}
                    disabled={isBusy}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 9,
                      border: `1px solid ${C.red}`, background: 'rgba(255,80,96,0.12)',
                      color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      opacity: isBusy ? 0.5 : 1,
                    }}
                  >{isBusy ? '...' : t('team.leaveConfirm')}</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmTeamId(tm.team_id)}
                  style={{
                    width: '100%', borderTop: `1px solid ${C.border}`,
                    background: 'transparent', border: 'none',
                    padding: '11px 16px', cursor: 'pointer',
                    color: C.red, fontSize: 12, fontWeight: 600,
                    letterSpacing: 0.3, textAlign: 'center',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {t('team.leave')}
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
      padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 18px 12px',
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
  const { t } = useTranslation('settings')
  const dayShort = t('dayShort', { returnObjects: true })
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
                {dayShort[d.getDay()]}
              </span>
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {showWarn && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ fontSize: 10, color: C.orange, fontWeight: 600, marginTop: 8, textAlign: 'center' }}>
            {t('editProfile.weekLimit', { maxDays })}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Frame picker ──────────────────────────────────────────────────────────────
function FramePicker({ current, uid, profile, onPick }) {
  const { t } = useTranslation('settings')
  // Lista + "unlocked" budowane z FRAME_CATALOG (lib/frames.js) — nowa ramka
  // w katalogu pojawia się tu automatycznie, zero zmian w tym pliku.
  const ALL_FRAMES = [
    { id: 'none', label: t('frames.none') },
    ...FRAME_CATALOG.map(f => ({ id: f.id, label: t(`frames.${f.id}`) })),
  ]
  const unlocked = useMemo(() => {
    const frames = new Set(['none'])
    for (const f of FRAME_CATALOG) {
      // current === f.id: fallback na sam start, zanim flaga w localStorage
      // zdąży się zapisać (np. tuż po ręcznym przyznaniu ramki w bazie).
      if (current === f.id || (uid && localStorage.getItem(frameSeenKey(f.id, uid)))) {
        frames.add(f.id)
      }
    }
    return frames
  }, [uid, profile?.username, current])

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
  const { t } = useTranslation('settings')
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
      <SubHeader title={t('editProfile.title')} onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 18px 40px' }}>

        {/* ── Dane profilowe ── */}
        <SLabel>{t('editProfile.profileData')}</SLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label={t('editProfile.nameLabel')} value={name} onChange={setName} placeholder={t('editProfile.namePlaceholder')}/>
          <Field label={t('editProfile.cityLabel')} value={city} onChange={setCity} placeholder={t('editProfile.cityPlaceholder')}/>
        </div>

        {/* ── Dane fizyczne ── */}
        <Divider/>
        <SLabel style={{ margin: '0 0 12px 2px' }}>{t('editProfile.physicalData')}</SLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <SpinPicker
            label={t('editProfile.birthYear')}
            value={birthYear}
            onChange={setBirthYear}
            min={currentYear - 60}
            max={currentYear - 10}
          />
          <SpinPicker
            label={t('editProfile.height')}
            value={heightCm}
            onChange={setHeightCm}
            min={140}
            max={230}
            unit="cm"
          />
        </div>

        {/* ── Plan tygodnia ── */}
        <Divider/>
        <SLabel style={{ margin: '0 0 12px 2px' }}>{t('editProfile.weekPlan')}</SLabel>

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
              <p style={{ fontSize: 8, color: C.dim, margin: '1px 0 0', letterSpacing: 0.5 }}>{t('editProfile.days')}</p>
            </button>
          ))}
        </div>

        {/* WeekPicker */}
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
          color: C.dim, margin: '0 0 8px 2px' }}>{t('editProfile.thisWeek')}</p>
        <WeekPicker trainingDays={days}/>

        {/* Przycisk zapisz (profil + plan) */}
        <AnimatePresence>
          {(dirty || saveState !== 'idle') && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 14 }}>
              <PrimaryBtn
                label={t(`editProfile.saveStates.${saveState}`)}
                onClick={handleSave}
                disabled={saveState === 'saving'}
                state={saveState}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ramka przeniesiona do personalizacji karty (gwiazdka) — pencil = tylko
           dane profilu, żeby edycja wyglądu i ustawień się nie dublowały. */}

        {/* ── Drużyny (zarządzanie członkostwem) ── */}
        <Divider/>
        <TeamsSection/>

      </div>
    </div>
  )
}

// ── Sub-view: Konto ───────────────────────────────────────────────────────────
function AccountView({ onBack, onClose, user }) {
  const { t } = useTranslation('settings')
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
      <SubHeader title={t('accountView.title')} onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 18px 36px' }}>

        <SLabel>{t('accountView.email')}</SLabel>
        <CardGroup>
          <Row
            label={user?.email_confirmed_at ? t('accountView.emailConfirmed') : t('accountView.emailUnconfirmed')}
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

        <SLabel>{t('accountView.password')}</SLabel>
        <CardGroup>
          <Row
            label={pwState === 'sent' ? t('accountView.passwordSent') : pwState === 'error' ? t('accountView.passwordError') : t('accountView.passwordChange')}
            sub={pwState === 'idle' ? t('accountView.passwordSub') : undefined}
            onClick={pwState === 'idle' ? handlePasswordReset : undefined}
          />
        </CardGroup>

        <SLabel>{t('accountView.deleteAccount')}</SLabel>
        {delState === 'idle' ? (
          <CardGroup>
            <Row label={t('accountView.deleteAccount')} danger onClick={() => setDelState('confirm')}/>
          </CardGroup>
        ) : (
          <div style={{
            background: 'rgba(255,80,96,0.06)', border: `1px solid rgba(255,80,96,0.18)`,
            borderRadius: 12, padding: '14px 16px',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.red, margin: '0 0 4px' }}>{t('accountView.deleteConfirmTitle')}</p>
            <p style={{ fontSize: 10.5, color: C.sub, margin: '0 0 14px', lineHeight: 1.5 }}>
              {t('accountView.deleteConfirmBody')}
            </p>
            <a href={`mailto:kontakt@hoopconnect.pl?subject=${encodeURIComponent(t('accountView.deleteEmailSubject'))}`} style={{
              display: 'block', padding: '10px', background: C.red,
              borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#fff',
              textDecoration: 'none', textAlign: 'center',
            }}>{t('accountView.writeToUs')}</a>
            <button onClick={() => setDelState('idle')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 10, color: C.sub, marginTop: 10, width: '100%',
              WebkitTapHighlightColor: 'transparent',
            }}>{t('accountView.cancel')}</button>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Sub-view: Informacje ──────────────────────────────────────────────────────
function InfoView({ onBack, onClose }) {
  const { t } = useTranslation('settings')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title={t('infoView.title')} onBack={onBack} onClose={onClose}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 36px' }}>
        <SLabel>{t('infoView.documents')}</SLabel>
        <CardGroup>
          {[
            { label: t('infoView.privacyPolicy'), href: 'https://hoopconnect.pl/privacy' },
            { label: t('infoView.terms'),         href: 'https://hoopconnect.pl/terms'   },
            { label: t('infoView.contact'),       href: 'mailto:kontakt@hoopconnect.pl'  },
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
  const { t } = useTranslation('settings')
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
            {t('discord.title')}
          </p>
          <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>
            {t('discord.sub')}
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
  const { t, i18n } = useTranslation('settings')
  const [view, setView] = useState('main')

  useEffect(() => {
    if (!open) setTimeout(() => setView('main'), 300)
  }, [open])

  async function handleSignOut() { onClose(); await signOut() }

  const { matchWins, kotcWins } = useCardStats(profile?.id)

  // ── Card personalization (background + frame) ──────────────────────────────
  const bgCatalog = useBackgroundCatalog()
  const { owned: ownedBackgrounds, reload: reloadOwned } = useOwnedBackgrounds(profile?.id, bgCatalog)
  const [personalizing, setPersonalizing] = useState(false)
  const [draftBg,    setDraftBg]    = useState(null)
  const [draftFrame, setDraftFrame] = useState('none')
  const [savingPers, setSavingPers] = useState(false)
  const [code,     setCode]     = useState('')
  const [codeMsg,  setCodeMsg]  = useState(null)
  const [showCode, setShowCode] = useState(false)

  function openPersonalization() {
    setDraftBg(profile?.equipped_background || null)
    setDraftFrame(profile?.equipped_frame || 'none')
    setCode(''); setCodeMsg(null); setShowCode(false)
    setPersonalizing(true)
  }
  async function savePersonalization() {
    if (!profile?.id || savingPers) return
    setSavingPers(true)
    const patch = {
      equipped_background: draftBg || null,
      equipped_frame:      draftFrame === 'none' ? null : draftFrame,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id)
    if (!error) { setProfileData?.(patch); setPersonalizing(false) }
    setSavingPers(false)
  }
  async function handleRedeem() {
    if (!code.trim()) return
    try {
      const items = await redeemCode(code)
      setCode('')
      setCodeMsg({ ok: true, text: `Odblokowano: ${items?.[0]?.item_name || 'nagroda'}` })
      reloadOwned()
    } catch (e) {
      const map = {
        invalid_code: 'Nieprawidłowy kod', expired_code: 'Kod wygasł',
        code_exhausted: 'Kod wyczerpany', already_redeemed: 'Kod już wykorzystany',
        not_authenticated: 'Zaloguj się',
      }
      const msg = e?.message || ''
      const key = Object.keys(map).find(k => msg.includes(k))
      setCodeMsg({ ok: false, text: key ? map[key] : 'Nie udało się użyć kodu' })
    }
  }

  // Card shows the draft while personalizing, otherwise the saved profile values.
  const shownFrame = personalizing ? (draftFrame || 'none') : (profile?.equipped_frame || 'none')
  const shownBgId  = personalizing ? draftBg : profile?.equipped_background
  const shownBgAsset = backgroundAsset(bgCatalog, shownBgId)

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(i18n.language === 'pl' ? 'pl-PL' : 'en-US', { month: 'long', year: 'numeric' })
    : null

  const isMain = view === 'main'

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Glass backdrop — Settings is an OVERLAY on the main menu; the home
             shows through, strongly blurred. */}
          <motion.div key="sp-bd"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(6,13,26,0.3)',
              backdropFilter: 'blur(34px)', WebkitBackdropFilter: 'blur(34px)',
            }}
          />

          {/* Overlay column — TRANSPARENT so the blurred home shows around the
             card; the ✕ (top-right) closes. No bottom sheet, no drag handle. */}
          <motion.div key="sp-sheet"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            style={{
              position: 'fixed', top: 0, bottom: 0,
              left: 'max(0px, calc((100vw - 430px) / 2))',
              width: 'min(100vw, 430px)',
              zIndex: 501,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}>

            {/* ── MAIN VIEW ── */}
            <motion.div
              animate={{ x: isMain ? 0 : '-100%' }}
              transition={SLIDE}
              style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              }}>

              {/* Profile hero — the 3D card hangs on the blurred menu; e-mail + a
                  small edit affordance below open the card picker in place. */}
              <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 40px) 18px 0', position: 'relative' }}>
                <div style={{ width: 216, margin: '0 auto' }}>
                  <PlayerCard3D
                    name={profile?.name}
                    hcId={profile?.hc_id}
                    arenaLevel={profile?.arena_level ?? 0}
                    xp={profile?.xp ?? 0}
                    frameVariant={shownFrame}
                    background={shownBgAsset}
                    matchWins={matchWins}
                    kotcWins={kotcWins}
                    scale={0.72}
                    idle
                  />
                </div>

                {/* e-mail + edit affordance (opens the in-place card picker below) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                  <p style={{ fontSize: 12, color: C.sub, margin: 0, maxWidth: 220,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email}
                  </p>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => personalizing ? setPersonalizing(false) : openPersonalization()}
                    aria-label="Edytuj kartę"
                    style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
                      background: personalizing ? 'rgba(120,190,255,0.34)' : 'rgba(120,190,255,0.16)',
                      border: `1px solid ${personalizing ? 'rgba(150,200,255,0.6)' : 'rgba(150,200,255,0.35)'}`,
                      color: '#dbeeff', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                    </svg>
                  </motion.button>
                </div>
              </div>

              {personalizing ? (
                /* ── In-place card personalization (swaps the lower menu) ── */
                <div style={{ flex: 1, paddingTop: 14 }}>
                  <div style={{ padding: '0 18px' }}><SLabel>Tło karty</SLabel></div>
                  {ownedBackgrounds.length === 0 ? (
                    <p style={{ padding: '0 18px', color: C.sub, fontSize: 12, margin: '0 0 6px' }}>
                      Nie masz jeszcze żadnych teł — użyj kodu poniżej, żeby odblokować.
                    </p>
                  ) : (
                    <div className="hide-scrollbar" style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '0 18px 6px' }}>
                      {ownedBackgrounds.map(b => {
                        const sel = draftBg === b.id
                        return (
                          <button key={b.id} onClick={() => setDraftBg(sel ? null : b.id)}
                            style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, WebkitTapHighlightColor: 'transparent' }}>
                            <div style={{ borderRadius: 12, padding: 3,
                              border: `2px solid ${sel ? C.accent : C.border}`,
                              boxShadow: sel ? '0 0 16px rgba(91,184,245,0.5)' : 'none' }}>
                              <PlayerCard3D name={profile?.name} arenaLevel={profile?.arena_level ?? 0} xp={profile?.xp ?? 0}
                                background={b.asset_path} scale={0.26} interactive={false} blank/>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: sel ? '#dbeeff' : C.sub, maxWidth: 90,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div style={{ padding: '12px 18px 0' }}>
                    <SLabel>Ramka</SLabel>
                    <FramePicker current={draftFrame} uid={user?.id} profile={profile} onPick={setDraftFrame}/>
                  </div>

                  {/* Redeem code — tucked away: just a quiet link until tapped */}
                  <div style={{ padding: '20px 18px 0' }}>
                    {!showCode ? (
                      <button onClick={() => setShowCode(true)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                        color: C.dim, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                        WebkitTapHighlightColor: 'transparent' }}>
                        Masz kod? →
                      </button>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input autoFocus value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Wpisz kod"
                            style={{ flex: 1, padding: '11px 12px', borderRadius: 10, fontSize: 13, letterSpacing: 1,
                              border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.03)', color: C.text }}/>
                          <button onClick={handleRedeem} style={{ padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                            border: `1px solid ${C.border}`, background: C.bb, color: C.accent, fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Użyj</button>
                        </div>
                        {codeMsg && <p style={{ fontSize: 11, margin: '8px 0 0', color: codeMsg.ok ? '#4ade80' : '#ff6b6b' }}>{codeMsg.text}</p>}
                      </>
                    )}
                  </div>

                  <div style={{ padding: '22px 18px 44px', display: 'flex', gap: 10 }}>
                    <button onClick={() => setPersonalizing(false)} style={{ flex: 1, padding: '14px', borderRadius: 12, cursor: 'pointer',
                      border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontWeight: 700, fontSize: 13, fontFamily: 'inherit' }}>Anuluj</button>
                    <button onClick={savePersonalization} disabled={savingPers} style={{ flex: 2, padding: '14px', borderRadius: 12, cursor: savingPers ? 'default' : 'pointer', border: 'none',
                      background: 'linear-gradient(135deg, #1E6BB0, #5BB8F5)', color: '#fff', fontWeight: 800, fontSize: 14,
                      letterSpacing: 0.5, fontFamily: 'var(--font-display)', textTransform: 'uppercase', opacity: savingPers ? 0.6 : 1 }}>
                      {savingPers ? 'Zapisywanie…' : 'Zapisz'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Discord — tuż pod profilem */}
                  <div style={{ padding: '10px 18px 0' }}>
                    <DiscordCard/>
                  </div>

                  {/* Sekcje */}
                  <div style={{ padding: '0 18px' }}>

                    <SLabel>{t('account')}</SLabel>
                    <CardGroup>
                      <Row label={t('accountSettings')} sub={t('accountSub')} onClick={() => setView('account')}/>
                      <Row label="Profil" sub="Imię · Miasto · Dni treningu" onClick={() => setView('editProfile')}/>
                      <Row label={t('language')} sub={i18n.language === 'pl' ? t('polish') : t('english')} onClick={() => setView('language')}/>
                    </CardGroup>

                    <SLabel>{t('other')}</SLabel>
                    <CardGroup>
                      <Row label={t('info')} sub={t('infoSub')} onClick={() => setView('info')}/>
                    </CardGroup>

                  </div>
                </>
              )}

              {/* Sign out — hidden while personalizing */}
              {!personalizing && (
                <div style={{ padding: '24px 18px 44px', textAlign: 'center' }}>
                  <button onClick={handleSignOut} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: C.red,
                    WebkitTapHighlightColor: 'transparent', padding: '6px 16px',
                  }}>{t('signOut')}</button>
                  <p style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase',
                    color: C.dim, fontWeight: 600, margin: '10px 0 0' }}>
                    HoopConnect · {APP_VERSION}
                  </p>
                </div>
              )}

            </motion.div>

            {/* ── SUB VIEWS ── */}
            <motion.div
              animate={{ x: isMain ? '100%' : 0 }}
              transition={SLIDE}
              style={{
                position: 'absolute', inset: 0,
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
                  <SubHeader title={t('language')} onBack={() => setView('main')} onClose={onClose}/>
                  <div style={{ padding: '0 18px' }}>
                    <SLabel>{t('availableLanguages')}</SLabel>
                    <CardGroup>
                      {[{ code: 'pl', label: t('polish') }, { code: 'en', label: t('english') }].map(l => (
                        <Row key={l.code} label={l.label}
                          onClick={() => i18n.changeLanguage(l.code)}
                          right={i18n.language === l.code ? (
                            <div style={{ width: 18, height: 18, borderRadius: '50%',
                              background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                                stroke="#000" strokeWidth="3" strokeLinecap="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          ) : null}
                        />
                      ))}
                    </CardGroup>
                  </div>
                </div>
              )}
              {view === 'info' && (
                <InfoView onBack={() => setView('main')} onClose={onClose}/>
              )}

            </motion.div>

            {/* ✕ close — top-right of the overlay, only on the main view */}
            {isMain && (
              <button onClick={onClose} aria-label={t('close', { defaultValue: 'Zamknij' })}
                style={{
                  position: 'absolute', zIndex: 20,
                  top: 'calc(env(safe-area-inset-top, 0px) + 14px)', right: 18,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'rgba(10,20,38,0.5)', border: '1px solid rgba(150,200,255,0.22)',
                  color: '#cfe0f2', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
              </button>
            )}

          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
