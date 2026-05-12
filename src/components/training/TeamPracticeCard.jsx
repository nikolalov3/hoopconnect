import { motion } from 'framer-motion'

/**
 * Card pokazywany w HomePage gracza w dniu, w którym trener zaplanował trening
 * drużynowy. Wizualnie wyróżniony od auto-generowanych kart treningowych —
 * ramka w kolorze drużyny, ikona gwizdka, label "TRENING DRUŻYNOWY".
 */
export default function TeamPracticeCard({ practice }) {
  const color = practice.team_color || '#5BB8F5'
  const time = new Date(practice.scheduled_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  const duration = practice.duration_min

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card"
      style={{
        padding: 14,
        borderLeft: `3px solid ${color}`,
        borderColor: `${color}30`,
        background: `linear-gradient(135deg, ${color}08 0%, rgba(6,14,30,0.55) 100%)`,
        marginBottom: 10,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Whistle icon */}
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: `${color}22`, color, flexShrink: 0,
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="12" r="6"/>
            <path d="M15 12h7l-2-3-2 3"/>
            <path d="M9 6V4"/>
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
            textTransform: 'uppercase', color, marginBottom: 2,
          }}>
            Trening drużynowy
          </div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)', letterSpacing: 0.3, textTransform: 'uppercase',
          }}>
            {practice.team_name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {time}{duration ? ` · ${duration} min` : ''}
            {practice.location ? ` · ${practice.location}` : ''}
          </div>
        </div>
      </div>

      {practice.notes && (
        <div style={{
          marginTop: 10, paddingTop: 10,
          borderTop: '1px solid rgba(120,190,255,0.10)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45,
        }}>
          {practice.notes}
        </div>
      )}
    </motion.div>
  )
}
