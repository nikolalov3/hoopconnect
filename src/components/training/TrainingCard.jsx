import { useState } from 'react'
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
        boxShadow: i <= n ? '0 0 6px rgba(91,184,245,0.60)' : 'none',
        transition: 'background 0.2s',
      }} />
    ))}
  </span>
)

const ChevronIcon = ({ up }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d={up ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
  </svg>
)

export default function TrainingCard({ training, done, onDone, onUndo }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()
  const isShooting = SHOOTING_TYPES.includes(training.type)
  const typeInfo = TYPE_LABELS[training.type] || { label: training.type, color: 'badge-gray' }

  function handleAction(e) {
    e.stopPropagation()
    if (isShooting) navigate(`/shooting/${training.id}`, { state: { training } })
    else onDone()
  }

  return (
    <motion.div
      layout
      style={{
        background: done
          ? 'rgba(0,230,118,0.06)'
          : 'rgba(6,14,30,0.52)',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: done
          ? '1px solid rgba(0,230,118,0.18)'
          : '1px solid rgba(120,190,255,0.09)',
        borderTop: done
          ? '1px solid rgba(0,230,118,0.28)'
          : '1px solid rgba(160,210,255,0.16)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
        transition: 'border-color 0.3s',
      }}
    >
      {/* Header row */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* Done circle */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            border: done ? 'none' : '1.5px solid rgba(255,255,255,0.12)',
            background: done
              ? 'linear-gradient(135deg, #00E676, #00A854)'
              : 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: done ? '0 2px 12px rgba(0,230,118,0.40)' : 'none',
            transition: 'all 0.3s',
          }}>
            {done && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            )}
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <span className={`badge ${training._pts != null ? (training._pts === 1 ? 'badge-gray' : 'badge-green') : typeInfo.color}`}>
                {training._pts != null ? `${training._pts}PKT` : typeInfo.label}
              </span>
              {training._multiplier != null && (
                <span style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
                  ×{training._multiplier}
                </span>
              )}
            </div>
            <h3 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 20,
              lineHeight: 1.15,
              color: done ? 'var(--text-dim)' : 'var(--text-primary)',
              textDecoration: done ? 'line-through' : 'none',
              textDecorationColor: 'rgba(255,255,255,0.20)',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
            }}>
              {training.title}
            </h3>
            <div style={{ marginTop: 8 }}>
              <DiffDots n={training.difficulty} />
            </div>
          </div>

          <span style={{ color: 'var(--text-dim)', marginTop: 4, flexShrink: 0 }}>
            <ChevronIcon up={expanded} />
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
                    <img key={i} src={url} alt=""
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
                <button className="btn-primary" onClick={handleAction} style={{ fontSize: 15, padding: '13px' }}>
                  {isShooting ? 'Zacznij tracker rzutów' : 'Ukończ ćwiczenie'}
                </button>
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
                  {onUndo && (
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
