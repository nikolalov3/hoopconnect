import { useState, useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const TYPE_LABELS = {
  shooting_3pt: { label: '3PKT',         color: 'badge-orange' },
  shooting_2pt: { label: '2PKT',         color: 'badge-green'  },
  shooting_ft:  { label: 'WOLNE',        color: 'badge-gray'   },
  fitness:      { label: 'FITNESS',      color: 'badge-gray'   },
  skills:       { label: 'UMIEJĘTNOŚCI', color: 'badge-gray'   },
  dribbling:    { label: 'KOZŁOWANIE',   color: 'badge-gray'   },
  running:      { label: 'BIEGANIE',     color: 'badge-red'    },
}
const SHOOTING_TYPES = ['shooting_3pt', 'shooting_2pt', 'shooting_ft']

const DiffDots = ({ n }) => (
  <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
    {[1,2,3,4,5].map(i => (
      <span key={i} style={{
        width: 5, height: 5, borderRadius: '50%',
        background: i <= n ? 'var(--orange)' : 'rgba(255,255,255,0.10)',
        boxShadow: i <= n ? '0 0 6px rgba(91,184,245,0.54)' : 'none',
        transition: 'background 0.2s',
      }} />
    ))}
  </span>
)

const ChevronIcon = ({ up }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

function TrainingCard({ training, done, onDone, onUndo, onSwap, canSwap }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const isShooting = SHOOTING_TYPES.includes(training.type)
  const typeInfo = TYPE_LABELS[training.type] || { label: training.type, color: 'badge-gray' }

  // Pulse: zielony przy ukończeniu, niebieski przy swap-ie ćwiczenia.
  // Triggerujemy tylko na faktyczne PRZEJŚCIE stanu (nie na każdy mount).
  const [pulse, setPulse] = useState(null) // { key, type }
  const prevDone = useRef(done)
  const prevId   = useRef(training.id)
  useEffect(() => {
    if (!prevDone.current && done) setPulse(p => ({ key: (p?.key || 0) + 1, type: 'done' }))
    prevDone.current = done
  }, [done])
  useEffect(() => {
    if (prevId.current && prevId.current !== training.id) {
      setPulse(p => ({ key: (p?.key || 0) + 1, type: 'swap' }))
    }
    prevId.current = training.id
  }, [training.id])

  function handleAction(e) {
    e.stopPropagation()
    if (isShooting) navigate(`/shooting/${training.id}`, { state: { training } })
    else onDone()
  }

  return (
    <motion.div
      animate={pulse?.key
        ? pulse.type === 'done'
          ? {
              scale: [1, 1.025, 1],
              boxShadow: [
                '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
                '0 6px 28px rgba(0,230,118,0.40), inset 0 1px 0 rgba(180,220,255,0.06)',
                '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
              ],
            }
          : {
              // Swap pulse — niebieski, neutralny. Płynne przejście na nowe ćwiczenie.
              scale: [0.97, 1.02, 1],
              boxShadow: [
                '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
                '0 6px 28px rgba(91,184,245,0.36), inset 0 1px 0 rgba(180,220,255,0.06)',
                '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
              ],
            }
        : { scale: 1 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      style={{
        background: done
          ? 'linear-gradient(180deg, rgba(0,230,118,0.10) 0%, rgba(0,140,80,0.06) 100%)'
          : 'linear-gradient(180deg, rgba(36,52,82,0.62) 0%, rgba(22,34,58,0.58) 100%)',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: done
          ? '1px solid rgba(0,230,118,0.22)'
          : '1px solid rgba(150,200,255,0.14)',
        borderTop: done
          ? '1px solid rgba(0,230,118,0.30)'
          : '1px solid rgba(180,215,255,0.22)',
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Header */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '16px 18px' }}>
        {/* Główny wiersz: check + tytuł + chevron na jednej linii (perfekcyjne wycentrowanie) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* Done check — 3D pusty (szary) kiedy nie zaliczone, zielony kiedy zaliczone */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: done
              ? 'linear-gradient(135deg, #00E676, #00A854)'
              : 'linear-gradient(145deg, rgba(70,82,100,0.55) 0%, rgba(30,38,52,0.55) 100%)',
            border: done
              ? '1px solid rgba(0,230,118,0.55)'
              : '1px solid rgba(255,255,255,0.10)',
            boxShadow: done
              ? '0 2px 12px rgba(0,230,118,0.36), inset 0 1px 0 rgba(255,255,255,0.25)'
              : 'inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -1px 2px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)',
            transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={done ? '#fff' : 'rgba(255,255,255,0.32)'}
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: 'stroke 0.3s' }}>
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>

          <h3 style={{
            flex: 1, minWidth: 0, margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 19,
            lineHeight: 1.2,
            color: done ? 'var(--text-dim)' : 'var(--text-primary)',
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: 'rgba(255,255,255,0.20)',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}>
            {training.title}
          </h3>

          <span style={{ color: 'var(--text-dim)', flexShrink: 0, display: 'flex' }}>
            <ChevronIcon up={expanded} />
          </span>
        </div>

        {/* Meta — badge + multiplier + trudność, w jednej linii, lekko wcięta pod tytułem */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, paddingLeft: 44 }}>
          <span
            className={`badge ${training._pts != null ? (training._pts === 1 ? 'badge-gray' : 'badge-green') : typeInfo.color}`}
            style={{ borderRadius: 6 }}
          >
            {training._pts != null ? `${training._pts}PKT` : typeInfo.label}
          </span>
          {training._multiplier != null && (
            <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
              ×{training._multiplier}
            </span>
          )}
          <span style={{ marginLeft: 'auto' }}>
            <DiffDots n={training.difficulty} />
          </span>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 18px 18px',
              borderTop: '1px solid rgba(255,255,255,0.07)',
            }}>
              {training.description && (
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: 1.65,
                  marginTop: 14,
                  marginBottom: 14,
                }}>
                  {training.description}
                </p>
              )}

              {training.images?.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                  {training.images.map((url, i) => (
                    <img key={i} src={url} alt="" loading="lazy" decoding="async"
                      style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
                    />
                  ))}
                </div>
              )}

              {training.instructions?.length > 0 && (
                <ol style={{ paddingLeft: 20, margin: '8px 0 16px' }}>
                  {training.instructions.map((step, i) => (
                    <li key={i} style={{
                      color: 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 400,
                      lineHeight: 1.65,
                      marginBottom: 6,
                    }}>
                      {step}
                    </li>
                  ))}
                </ol>
              )}

              {!done ? (
                <>
                  <button className="btn-primary" onClick={handleAction} style={{ fontSize: 15, padding: '13px' }}>
                    {isShooting ? 'Zacznij tracker rzutów' : 'Ukończ ćwiczenie'}
                  </button>
                  {training.requires_equipment && onSwap && canSwap && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSwap(training.id) }}
                      style={{
                        width: '100%', marginTop: 10, padding: '11px 8px',
                        background: 'transparent', border: 'none',
                        color: 'rgba(180,195,220,0.62)',
                        fontSize: 12, fontWeight: 500, letterSpacing: 0.1,
                        cursor: 'pointer', borderRadius: 14,
                        fontFamily: 'var(--font-body)',
                        textDecoration: 'underline', textUnderlineOffset: 3,
                      }}
                    >
                      Nie mam {training.equipment_label ? `(${training.equipment_label})` : 'sprzętu'} — zmień ćwiczenie
                    </button>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <p style={{
                    color: 'var(--green-shot)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                  }}>
                    ✓ Ukończono
                  </p>
                  {onUndo && !isShooting && (
                    <button
                      onClick={e => { e.stopPropagation(); onUndo() }}
                      style={{
                        marginTop: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'rgba(255,80,80,0.70)',
                        fontSize: 11,
                        fontFamily: 'var(--font-body)',
                        fontWeight: 500,
                        letterSpacing: 0.5,
                        padding: '2px 0',
                        textDecoration: 'underline',
                        textUnderlineOffset: 3,
                      }}
                    >
                      Anuluj zaznaczenie
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default memo(TrainingCard)
