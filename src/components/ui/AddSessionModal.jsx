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

// ── Strength session builder ────────────────────────────────────────────────
function StrengthBuilder({ onSave, saving }) {
  const [exercises, setExercises] = useState([{ name: '', custom: '', sets: '', reps: '', weight_kg: '' }])
  const [notes, setNotes] = useState('')

  function update(idx, field, value) {
    setExercises(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }
  function add() {
    if (exercises.length >= 12) return
    setExercises(prev => [...prev, { name: '', custom: '', sets: '', reps: '', weight_kg: '' }])
  }
  function remove(idx) {
    setExercises(prev => prev.filter((_, i) => i !== idx))
  }

  const valid = exercises.every(e => {
    const name = e.name === '__custom__' ? e.custom.trim() : e.name
    return name && parseInt(e.sets) > 0 && parseInt(e.reps) > 0
  }) && exercises.length > 0

  function handleSave() {
    const cleaned = exercises.map(e => ({
      name: e.name === '__custom__' ? e.custom.trim() : e.name,
      sets: parseInt(e.sets),
      reps: parseInt(e.reps),
      weight_kg: e.weight_kg ? parseFloat(e.weight_kg) : null,
    }))
    onSave({ exercises: cleaned, notes: notes.trim() || null })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {exercises.map((e, idx) => (
        <div key={idx} style={{
          padding: 12,
          background: 'rgba(40,55,85,0.35)',
          borderRadius: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
          boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.14)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
              color: 'var(--text-dim)', textTransform: 'uppercase',
            }}>Ćwiczenie {idx + 1}</span>
            {exercises.length > 1 && (
              <button onClick={() => remove(idx)} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                color: 'rgba(255,80,80,0.70)', fontSize: 11, cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3, padding: '2px 4px',
              }}>Usuń</button>
            )}
          </div>
          <select
            value={e.name}
            onChange={ev => update(idx, 'name', ev.target.value)}
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(8,16,30,0.6)', border: '1px solid rgba(150,200,255,0.14)',
              color: 'var(--text-primary)', fontSize: 14,
              fontFamily: 'var(--font-body)',
            }}>
            <option value="">— wybierz ćwiczenie —</option>
            {PRESET_EXERCISES.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__custom__">Inne (wpisz)</option>
          </select>
          {e.name === '__custom__' && (
            <input
              type="text" placeholder="Nazwa ćwiczenia"
              value={e.custom}
              onChange={ev => update(idx, 'custom', ev.target.value)}
              style={{
                padding: '10px 12px', borderRadius: 10,
                background: 'rgba(8,16,30,0.6)', border: '1px solid rgba(150,200,255,0.14)',
                color: 'var(--text-primary)', fontSize: 14,
                fontFamily: 'var(--font-body)',
              }}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 8 }}>
            <input
              type="number" inputMode="numeric" min="1" placeholder="Serie"
              value={e.sets}
              onChange={ev => update(idx, 'sets', ev.target.value.replace(/[^0-9]/g, ''))}
              style={inputStyle}
            />
            <input
              type="number" inputMode="numeric" min="1" placeholder="Powtórz."
              value={e.reps}
              onChange={ev => update(idx, 'reps', ev.target.value.replace(/[^0-9]/g, ''))}
              style={inputStyle}
            />
            <input
              type="number" inputMode="decimal" min="0" placeholder="Ciężar (kg) — opt."
              value={e.weight_kg}
              onChange={ev => update(idx, 'weight_kg', ev.target.value.replace(/[^0-9.]/g, ''))}
              style={inputStyle}
            />
          </div>
        </div>
      ))}

      <button onClick={add} disabled={exercises.length >= 12} style={{
        padding: '11px', borderRadius: 12,
        background: 'rgba(91,184,245,0.10)',
        border: '1px dashed rgba(91,184,245,0.35)',
        color: '#7ECBFF', fontSize: 13, fontWeight: 600,
        letterSpacing: 0.5, cursor: exercises.length >= 12 ? 'not-allowed' : 'pointer',
        opacity: exercises.length >= 12 ? 0.4 : 1,
        fontFamily: 'var(--font-body)',
      }}>
        + Dodaj ćwiczenie {exercises.length >= 12 ? '(max 12)' : ''}
      </button>

      <textarea
        placeholder="Notatka (opcjonalna, max 200 znaków)"
        maxLength={200}
        value={notes}
        onChange={ev => setNotes(ev.target.value)}
        style={{
          padding: '10px 12px', borderRadius: 10, minHeight: 60, resize: 'vertical',
          background: 'rgba(8,16,30,0.6)', border: '1px solid rgba(150,200,255,0.14)',
          color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)',
        }}
      />

      <button onClick={handleSave} disabled={!valid || saving} className="btn-primary"
        style={{ padding: 13, opacity: (!valid || saving) ? 0.4 : 1, marginTop: 4 }}>
        {saving ? 'Zapisuję...' : 'Zapisz trening'}
      </button>
    </div>
  )
}

const inputStyle = {
  padding: '10px 12px', borderRadius: 10,
  background: 'rgba(8,16,30,0.6)', border: '1px solid rgba(150,200,255,0.14)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-body)',
  textAlign: 'center',
}

// ── Main modal ──────────────────────────────────────────────────────────────
export default function AddSessionModal({ open, onClose, onSaveStrength, saving }) {
  const [tab, setTab] = useState('shooting')
  const navigate = useNavigate()

  function pickShootZone(type) {
    onClose()
    // Freestyle tracker — bez training_id, bez points_log. Tracker pozna po param.
    navigate(`/shooting/freestyle?type=${type}`)
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
                <p style={{ color: 'rgba(180,195,220,0.55)', fontSize: 11, textAlign: 'center', marginTop: 10 }}>
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
