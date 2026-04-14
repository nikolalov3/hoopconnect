import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useUI } from '../../context/UIContext'

const HomeIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
)
const StatsIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
)
const TrophyIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2h12v6a6 6 0 0 1-12 0V2z"/>
    <path d="M6 4H3a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4"/>
    <path d="M18 4h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4"/>
    <path d="M12 14v4"/><path d="M8 22h8"/>
  </svg>
)
const RecoveryIcon = ({ active }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

const TABS = [
  { path: '/',             Icon: HomeIcon,    label: 'Dziś' },
  { path: '/stats',        Icon: StatsIcon,   label: 'Stats' },
  { path: '/recovery',     Icon: RecoveryIcon,label: 'Regen' },
  { path: '/achievements', Icon: TrophyIcon,  label: 'Trofea' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { settingsOpen } = useUI()
  const [hasUnread, setHasUnread] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_achievements')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .is('seen_at', null)
      .then(({ count }) => setHasUnread((count ?? 0) > 0))
  }, [pathname, profile])

  return (
    <AnimatePresence initial={false}>
    {!settingsOpen && (
    <div style={{ position: 'absolute', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 200 }}>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.16, ease: 'easeInOut' }}
    >
      <div style={{
        position: 'absolute', inset: -1, borderRadius: 9999,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 20px 60px rgba(0,0,0,0.70)',
        pointerEvents: 'none',
      }} />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'rgba(10,6,3,0.65)',
        backdropFilter: 'blur(40px) saturate(2.0) brightness(1.15)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.0) brightness(1.15)',
        border: '1px solid rgba(255,255,255,0.13)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        borderTop: '1px solid rgba(255,255,255,0.22)',
        borderRadius: 9999,
        padding: '6px 8px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -1px 0 rgba(0,0,0,0.30)',
      }}>
        {TABS.map(({ path, Icon, label }) => {
          const active = pathname === path
          const showDot = path === '/achievements' && hasUnread && !active
          return (
            <motion.button key={path} onClick={() => navigate(path)} whileTap={{ scale: 0.88 }}
              style={{
                position: 'relative',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 52, height: 48,
                background: active
                  ? 'linear-gradient(145deg, rgba(40,130,220,0.92) 0%, rgba(16,90,180,0.96) 100%)'
                  : 'transparent',
                border: active ? '1px solid rgba(91,184,245,0.50)' : '1px solid transparent',
                borderRadius: 9999,
                cursor: 'pointer',
                color: active ? '#fff' : 'rgba(180,120,80,0.60)',
                transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: active ? '0 4px 20px rgba(91,184,245,0.50), inset 0 1px 0 rgba(180,230,255,0.25)' : 'none',
              }}
            >
              <Icon active={active} />
              {showDot && (
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  style={{
                    position: 'absolute', top: 8, right: 10,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#FF3B30',
                    boxShadow: '0 0 6px 2px rgba(255,59,48,0.70)',
                    border: '1.5px solid rgba(10,6,3,0.85)',
                  }}
                />
              )}
              {active && (
                <motion.div layoutId="nav-glow" transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  style={{
                    position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)',
                    width: 4, height: 4, borderRadius: '50%',
                    background: '#5BB8F5', boxShadow: '0 0 8px 2px rgba(91,184,245,0.60)',
                  }}
                />
              )}
            </motion.button>
          )
        })}
      </div>
    </motion.div>
    </div>
    )}
    </AnimatePresence>
  )
}
