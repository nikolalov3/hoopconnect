import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoachAuth } from '../context/CoachAuthContext'

/**
 * Dropdown in sidebar header that lets the coach switch active team and
 * navigate to TeamsHubPage to manage all teams.
 */
export default function TeamSwitcher() {
  const { teams, currentTeam, setCurrentTeam } = useCoachAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  if (!currentTeam) return null

  const handleSwitch = (teamId) => {
    setCurrentTeam(teamId)
    setOpen(false)
  }

  const handleManage = () => {
    setOpen(false)
    navigate('/teams')
  }

  return (
    <div ref={wrapperRef} className="coach-team-switcher">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="coach-team-switcher-trigger"
      >
        <div className="coach-team-switcher-badge" style={{ background: currentTeam.primary_color || '#5591CD' }}>
          {currentTeam.name.charAt(0).toUpperCase()}
        </div>
        <div className="coach-team-switcher-info">
          <div className="coach-team-switcher-name">{currentTeam.name}</div>
          <div className="coach-team-switcher-meta">
            {currentTeam.age_category} · {currentTeam.section === 'M' ? 'Męska' : currentTeam.section === 'K' ? 'Żeńska' : 'Mixed'}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#8A9AB0', flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="coach-team-switcher-menu">
          <div className="coach-team-switcher-menu-label">Twoje drużyny</div>
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => handleSwitch(t.id)}
              className={'coach-team-switcher-item' + (t.id === currentTeam.id ? ' active' : '')}
            >
              <div className="coach-team-switcher-badge" style={{ background: t.primary_color || '#5591CD', width: 28, height: 28, fontSize: 12 }}>
                {t.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div className="coach-team-switcher-name" style={{ fontSize: 13 }}>{t.name}</div>
                <div className="coach-team-switcher-meta">{t.age_category} · {t.section}</div>
              </div>
              {t.id === currentTeam.id && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5591CD" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          ))}

          <div className="coach-team-switcher-divider"/>

          <button onClick={handleManage} className="coach-team-switcher-item">
            <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F6F8FB', border: '1px dashed #D4DDE8', display: 'grid', placeItems: 'center', color: '#5591CD' }}>+</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1E3A5F' }}>Wszystkie drużyny</span>
          </button>
        </div>
      )}
    </div>
  )
}
