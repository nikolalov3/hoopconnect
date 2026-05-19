import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// Predefiniowane ćwiczenia siłowe — hybryda (lista + "Inne" free-text)
const PRESET_EXERCISES = [
  'Wyciskanie sztangą leżąc',
  'Przysiad ze sztangą',
  'Martwy ciąg',
  'Wyciskanie nad głowę',
  'Wiosłowanie sztangą',
  'Podciągnięcia',
  'Pompki na poręczach',
  'Bulgarian split squat',
  'Romanian deadlift',
  'Goblet squat',
  'Wyciskanie hantlami',
  'Hip thrust',
  'Box jump',
  'Pistol squat',
  'Farmer carry',
  'Plank',
  'Russian twist',
]

// ── Half-court SVG (zaadaptowany z ClubPage) ────────────────────────────────
// 3 strefy klikalne: 3pt (powyżej łuku), mid-range (między łukiem a trumną),
// ft/trumna (paint). Każda strefa = pełna kategoria rzutów do trackera.
function HalfCourtPicker({ onPickZone }) {
  const [hoverZone, setHoverZone] = useState(null)

  // Color per zone: 3pt = red (najdalszy/najtrudniejszy), 2pt = orange (mid),
  // ft = green (linia rzutów wolnych, "bezpieczna" strefa).
  const ZONE_RGB = { '3pt': '255,80,80', '2pt': '255,160,40', 'ft': '0,210,118' }
  const tint = (z) => `rgba(${ZONE_RGB[z]},${hoverZone === z ? 0.20 : 0.06})`
  const ringColor = (z) => `rgba(${ZONE_RGB[z]},0.90)`

  const LINE = 'rgba(0,210,255,0.40)'
  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '343 / 410', borderRadius: 14, overflow: 'hidden' }}>
      <svg viewBox="0 0 343 410" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="addCourtFloor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#13203A"/>
            <stop offset="55%"  stopColor="#0C1824"/>
            <stop offset="100%" stopColor="#080F1A"/>
          </linearGradient>
        </defs>

        {/* Floor */}
        <rect width="343" height="410" fill="url(#addCourtFloor)"/>

        {/* 3pt zone — klikalne tło */}
        <path
          d="M 12 1 H 331 V 272 A 204 204 0 0 0 12 272 Z"
          fill={tint('3pt')}
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onMouseEnter={() => setHoverZone('3pt')}
          onMouseLeave={() => setHoverZone(null)}
          onClick={() => onPickZone('3pt')}
        />
        {/* Mid-range zone — klikalne tło */}
        <path
          d="M 12 272 A 204 204 0 0 1 331 272 V 398 H 221 V 260 A 49 49 0 0 0 122 260 V 398 H 12 Z"
          fill={tint('2pt')}
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onMouseEnter={() => setHoverZone('2pt')}
          onMouseLeave={() => setHoverZone(null)}
          onClick={() => onPickZone('2pt')}
        />
        {/* Paint / FT zone (trumna) — klikalne tło */}
        <path
          d="M 122 260 A 49 49 0 0 1 221 260 V 398 H 122 Z"
          fill={tint('ft')}
          style={{ cursor: 'pointer', transition: 'fill 0.15s' }}
          onMouseEnter={() => setHoverZone('ft')}
          onMouseLeave={() => setHoverZone(null)}
          onClick={() => onPickZone('ft')}
        />

        {/* ── Linie boiska (decorative, pointer-events off) ── */}
        <g fill="none" strokeLinecap="round" stroke={LINE} strokeWidth="1.4" style={{ pointerEvents: 'none' }}>
          {/* Court boundary */}
          <line x1="12"  y1="1"   x2="12"  y2="398"/>
          <line x1="331" y1="1"   x2="331" y2="398"/>
          <line x1="12"  y1="398" x2="331" y2="398"/>
          <line x1="12"  y1="1"   x2="331" y2="1"/>
          {/* 3pt corner extensions + arc */}
          <line x1="12"  y1="272" x2="12"  y2="398"/>
          <line x1="331" y1="272" x2="331" y2="398"/>
          <path d="M 12 272 A 204 204 0 0 1 331 272"/>
          {/* Paint (key) */}
          <rect x="122" y="260" width="99" height="138"/>
          {/* Free throw circle (top half solid) */}
          <path d="M 122 260 A 49 49 0 0 1 221 260"/>
          {/* Hash marks */}
          <line x1="110" y1="295" x2="122" y2="295" opacity="0.6"/>
          <line x1="110" y1="327" x2="122" y2="327" opacity="0.6"/>
          <line x1="221" y1="295" x2="233" y2="295" opacity="0.6"/>
          <line x1="221" y1="327" x2="233" y2="327" opacity="0.6"/>
          {/* Restricted area arc */}
          <path d="M 146 398 A 25 25 0 0 0 197 398" opacity="0.6"/>
          {/* Center circle (top of half-court) */}
          <path d="M 137 1 A 36 36 0 0 0 206 1" opacity="0.55"/>
        </g>

        {/* Strefowe outlines highlight on hover — kolor matchujący strefę */}
        {hoverZone === '3pt' && (
          <path d="M 12 1 H 331 V 272 A 204 204 0 0 0 12 272 Z"
            fill="none" stroke={ringColor('3pt')} strokeWidth="2" style={{ pointerEvents: 'none' }} />
        )}
        {hoverZone === '2pt' && (
          <path d="M 12 272 A 204 204 0 0 1 331 272 V 398 H 221 V 260 A 49 49 0 0 0 122 260 V 398 H 12 Z"
            fill="none" stroke={ringColor('2pt')} strokeWidth="2" style={{ pointerEvents: 'none' }} />
        )}
        {hoverZone === 'ft' && (
          <path d="M 122 260 A 49 49 0 0 1 221 260 V 398 H 122 Z"
            fill="none" stroke={ringColor('ft')} strokeWidth="2" style={{ pointerEvents: 'none' }} />
        )}

        {/* Hoop */}
        <circle cx="171.5" cy="377" r="13" fill="none" stroke="#FFA820" strokeWidth="2.5" style={{ pointerEvents: 'none' }}/>
        <circle cx="171.5" cy="377" r="5.5" fill="rgba(255,168,32,0.20)" style={{ pointerEvents: 'none' }}/>
        <rect x="150" y="393" width="43" height="4" rx="1.5" fill="#FFA820" opacity=".90" style={{ pointerEvents: 'none' }}/>

        {/* Labels */}
        <text x="171.5" y="145" textAnchor="middle"
          fontFamily="var(--font-display)" fontSize="22" fontWeight="800"
          fill={hoverZone === '3pt' ? ringColor('3pt') : 'rgba(255,255,255,0.88)'}
          style={{ pointerEvents: 'none', letterSpacing: 2 }}>TRÓJKI</text>
        <text x="62" y="340" textAnchor="middle"
          fontFamily="var(--font-display)" fontSize="13" fontWeight="700"
          fill={hoverZone === '2pt' ? ringColor('2pt') : 'rgba(255,255,255,0.78)'}
          style={{ pointerEvents: 'none', letterSpacing: 1.5 }}>MID</text>
        <text x="281" y="340" textAnchor="middle"
          fontFamily="var(--font-display)" fontSize="13" fontWeight="700"
          fill={hoverZone === '2pt' ? ringColor('2pt') : 'rgba(255,255,255,0.78)'}
          style={{ pointerEvents: 'none', letterSpacing: 1.5 }}>MID</text>
        <text x="171.5" y="335" textAnchor="middle"
          fontFamily="var(--font-display)" fontSize="13" fontWeight="800"
          fill={hoverZone === 'ft' ? ringColor('ft') : 'rgba(255,255,255,0.88)'}
          style={{ pointerEvents: 'none', letterSpacing: 1.5 }}>WOLNE</text>
      </svg>
    </div>
  )
}

// ── Stepper — +/− przycisk jak w trackerze rzutów ───────────────────────────
function Stepper({ label, value, onChange, min = 1, max = 99 }) {
  const btnStyle = {
    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(91,184,245,0.12)', border: '1px solid rgba(91,184,245,0.22)',
    color: '#7ECBFF', fontSize: 22, lineHeight: 1, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 300, userSelect: 'none',
  }
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <p style={{
        fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
        color: 'rgba(145,190,230,0.55)', fontWeight: 700, fontFamily: 'var(--font-body)',
      }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} style={btnStyle}>−</button>
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 34,
          color: 'var(--text-primary)', lineHeight: 1, minWidth: 44, textAlign: 'center',
        }}>{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} style={btnStyle}>+</button>
      </div>
    </div>
  )
}

// ── Strength session builder ────────────────────────────────────────────────
function StrengthBuilder({ onSave, saving }) {
  const [exercises, setExercises] = useState([{ name: '', custom: '', sets: 3, reps: 10, weight_kg: '' }])
  const [notes, setNotes] = useState('')

  function update(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }
  function add() {
    if (exercises.length >= 12) return
    setExercises(prev => [...prev, { name: '', custom: '', sets: 3, reps: 10, weight_kg: '' }])
  }
  function remove(idx) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  const valid = exercises.every(e => {
    const name = e.name === '__custom__' ? e.custom.trim() : e.name
    return name && e.sets > 0 && e.reps > 0
  }) && exercises.length > 0

  function handleSave() {
    const cleaned = exercises.map(e => ({
      name: e.name === '__custom__' ? e.custom.trim() : e.name,
      sets: e.sets,
      reps: e.reps,
      weight_kg: e.weight_kg ? parseFloat(e.weight_kg) : null,
    }))
    onSave({ exercises: cleaned, notes: notes.trim() || null })
  }

  const fieldStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '11px 14px', borderRadius: 12,
    background: 'rgba(8,16,30,0.55)', border: '1px solid rgba(150,200,255,0.12)',
    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {exercises.map((e, idx) => (
        <div key={idx} style={{
          background: 'rgba(22,34,58,0.60)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 18,
          border: '1px solid rgba(150,200,255,0.10)',
          boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.18), 0 2px 12px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px 0',
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11,
              letterSpacing: 2.5, textTransform: 'uppercase', color: '#5BB8F5',
            }}>Ćwiczenie {idx + 1}</span>
            {exercises.length > 1 && (
              <button type="button" onClick={() => remove(idx)} style={{
                background: 'none', border: 'none', color: 'rgba(255,80,80,0.60)',
                fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)',
                fontWeight: 500, padding: 0,
              }}>Usuń</button>
            )}
          </div>

          {/* Exercise select */}
          <div style={{ padding: '10px 16px 0' }}>
            <select
              value={e.name}
              onChange={ev => update(idx, 'name', ev.target.value)}
              style={fieldStyle}>
              <option value="">— wybierz ćwiczenie —</option>
              {PRESET_EXERCISES.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">Inne (wpisz własne)</option>
            </select>
            {e.name === '__custom__' && (
              <input
                type="text" placeholder="Nazwa ćwiczenia"
                value={e.custom}
                onChange={ev => update(idx, 'custom', ev.target.value)}
                style={{ ...fieldStyle, marginTop: 8 }}
              />
            )}
          </div>

          {/* Stepper row */}
          <div style={{
            display: 'flex', gap: 8,
            padding: '18px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            marginTop: 14,
          }}>
            <Stepper label="Serie" value={e.sets} onChange={v => update(idx, 'sets', v)} />
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />
            <Stepper label="Powtórzenia" value={e.reps} onChange={v => update(idx, 'reps', v)} />
          </div>

          {/* Weight — optional, pełna szerokość */}
          <div style={{ padding: '0 16px 16px' }}>
            <input
              type="number" inputMode="decimal" min="0"
              placeholder="Ciężar (kg) — opcjonalny"
              value={e.weight_kg}
              onChange={ev => update(idx, 'weight_kg', ev.target.value.replace(/[^0-9.]/g, ''))}
              style={fieldStyle}
            />
          </div>
        </div>
      ))}

      <button type="button" onClick={add} disabled={exercises.length >= 12} style={{
        padding: '13px', borderRadius: 14,
        background: 'rgba(91,184,245,0.08)',
        border: '1px dashed rgba(91,184,245,0.30)',
        color: '#7ECBFF', fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
        cursor: exercises.length >= 12 ? 'not-allowed' : 'pointer',
        opacity: exercises.length >= 12 ? 0.35 : 1,
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
      }}>
        + Dodaj ćwiczenie
      </button>

      <textarea
        placeholder="Notatka (opcjonalna)"
        maxLength={200}
        value={notes}
        onChange={ev => setNotes(ev.target.value)}
        style={{
          ...fieldStyle, minHeight: 64, resize: 'none',
          lineHeight: 1.55,
        }}
      />

      <button type="button" onClick={handleSave} disabled={!valid || saving} className="btn-primary"
        style={{ padding: '15px', opacity: (!valid || saving) ? 0.35 : 1, marginTop: 4 }}>
        {saving ? 'Zapisuję...' : 'Zapisz sesję'}
      </button>
    </div>
  )
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 12px', borderRadius: 10,
  background: 'rgba(8,16,30,0.6)', border: '1px solid rgba(150,200,255,0.14)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
  textAlign: 'center',
}

// ── Main modal ──────────────────────────────────────────────────────────────
export default function AddSessionModal({ open, onClose, onSaveStrength, saving }) {
  const [tab, setTab] = useState('shooting')
  const [shotTarget, setShotTarget] = useState(20)  // default 20, krok 10, max 150
  const navigate = useNavigate()

  function pickShootZone(type) {
    onClose()
    // Freestyle tracker — bez training_id, bez points_log. Target = user-picked.
    navigate(`/shooting/freestyle?type=${type}&target=${shotTarget}`)
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="add-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(4,8,16,0.72)',
            backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            alignItems: 'center',
          }}
        >
          <motion.div
            key="add-sheet"
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 430,
              background: 'rgba(8,16,30,0.96)',
              backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
              borderRadius: '22px 22px 0 0',
              padding: '18px 20px 0',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 16px)',
              maxHeight: '92vh', overflowY: 'auto',
              boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.10), 0 -8px 48px rgba(0,0,0,0.60)',
            }}
          >
            {/* Drag pill */}
            <div style={{ width: 36, height: 4, background: 'rgba(180,220,255,0.18)',
              borderRadius: 2, margin: '0 auto 14px' }} />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)' }}>
                Dodaj sesję
              </p>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', color: 'var(--text-dim)',
                fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1,
              }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', marginBottom: 18,
              background: 'rgba(30,42,68,0.42)',
              borderRadius: 99, padding: 3,
              boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.08)',
            }}>
              {[
                { key: 'shooting', label: 'Rzuty' },
                { key: 'strength', label: 'Siła'  },
              ].map(t => {
                const active = tab === t.key
                return (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    flex: 1, padding: '10px 0', borderRadius: 99, border: 'none',
                    background: active ? 'linear-gradient(145deg, rgba(40,130,220,0.70), rgba(16,90,180,0.75))' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-dim)',
                    fontSize: 12, fontWeight: active ? 700 : 500,
                    letterSpacing: 0.5, textTransform: 'uppercase',
                    cursor: 'pointer', fontFamily: 'var(--font-body)',
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.20)' : 'none',
                    transition: 'background 0.18s, color 0.18s',
                  }}>{t.label}</button>
                )
              })}
            </div>

            {/* Tab content */}
            {tab === 'shooting' ? (
              <>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
                  Wybierz strefę boiska, z której chcesz rzucać. Tracker uruchomi sesję freestyle —
                  liczy się tylko do statystyk i osiągnięć (zero punktów do rankingu).
                </p>
                <HalfCourtPicker onPickZone={pickShootZone} />
                {/* Suwak liczby rzutów — default 20, krok 10, max 150 */}
                <div style={{ marginTop: 18, padding: '14px 16px',
                  background: 'rgba(30,42,68,0.42)',
                  borderRadius: 14,
                  boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.16)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.3, color: 'rgba(220,228,242,0.70)' }}>
                      Liczba rzutów
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#7ECBFF', lineHeight: 1 }}>
                      {shotTarget}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20} max={150} step={10}
                    value={shotTarget}
                    onChange={e => setShotTarget(parseInt(e.target.value))}
                    style={{
                      width: '100%', accentColor: '#5BB8F5',
                      background: 'transparent', height: 24, cursor: 'pointer',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(180,195,220,0.45)', marginTop: 2, fontWeight: 500 }}>
                    <span>20</span><span>150</span>
                  </div>
                </div>
                <p style={{ color: 'rgba(180,195,220,0.55)', fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                  Tap w strefę = rozpocznij sesję rzutów
                </p>
              </>
            ) : (
              <>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
                  Dodaj ćwiczenia z dzisiejszej sesji siłowej. Każde z liczbą serii i powtórzeń. Ciężar opcjonalny.
                </p>
                <StrengthBuilder onSave={onSaveStrength} saving={saving} />
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
