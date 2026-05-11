import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'

export default function TeamPage() {
  const navigate = useNavigate()
  const { currentTeam, user } = useCoachAuth()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => {
    if (!currentTeam) return
    loadRoster()
  }, [currentTeam?.id])

  async function loadRoster() {
    setLoading(true)
    const [{ data: m }, { data: inv }] = await Promise.all([
      supabase.from('team_members').select('*').eq('team_id', currentTeam.id),
      supabase.from('team_invites').select('*').eq('team_id', currentTeam.id).eq('status', 'pending').order('created_at', { ascending: false }),
    ])
    setMembers(m || [])
    setInvites(inv || [])
    setLoading(false)
  }

  if (!currentTeam) return null

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Drużyna · {currentTeam.name}</h1>
          <p className="coach-subtitle">
            {members.length} {members.length === 1 ? 'zawodnik' : members.length >= 2 && members.length <= 4 ? 'zawodników' : 'zawodników'}
            {invites.length > 0 && ` · ${invites.length} zaproszeń oczekuje`}
          </p>
        </div>
        <button className="coach-btn-primary" onClick={() => setShowInvite(true)}>+ Dodaj zawodnika</button>
      </header>

      {loading ? (
        <div className="coach-card"><div className="coach-placeholder" style={{ minHeight: 200 }}><div className="spinner" /></div></div>
      ) : (
        <>
          {/* Members list */}
          {members.length === 0 && invites.length === 0 ? (
            <div className="coach-card">
              <div className="coach-placeholder" style={{ minHeight: 240 }}>
                <div className="coach-placeholder-title">Brak zawodników</div>
                <div style={{ marginBottom: 18 }}>Wyślij zaproszenie e-mailowe — zawodnik zaakceptuje je w aplikacji.</div>
                <button className="coach-btn-primary" onClick={() => setShowInvite(true)}>Dodaj pierwszego zawodnika</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map(m => {
                const fullName = [m.display_first_name, m.display_last_name].filter(Boolean).join(' ')
                const initials = (m.display_first_name?.charAt(0) || '') + (m.display_last_name?.charAt(0) || '')
                return (
                  <button
                    key={m.player_id}
                    onClick={() => navigate(`/team/${m.player_id}`)}
                    className="coach-card"
                    style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 11,
                      background: '#E8F1FA', color: '#1E3A5F',
                      fontWeight: 700, fontSize: 14,
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      {initials || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: fullName ? '#1A2233' : '#8A9AB0', fontStyle: fullName ? 'normal' : 'italic' }}>
                        {fullName || 'Bez imienia · uzupełnij'}
                      </div>
                      <div style={{ fontSize: 12, color: '#8A9AB0' }}>
                        {m.jersey_number ? `#${m.jersey_number}` : 'bez numeru'}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9AB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                )
              })}

              {invites.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', padding: '12px 4px 4px' }}>
                    Oczekujące zaproszenia
                  </div>
                  {invites.map(inv => {
                    const fullName = [inv.invited_first_name, inv.invited_last_name].filter(Boolean).join(' ')
                    const initials = (inv.invited_first_name?.charAt(0) || '') + (inv.invited_last_name?.charAt(0) || '')
                    const emailInitial = inv.invited_email?.charAt(0)?.toUpperCase() || '?'
                    return (
                    <div key={inv.id} className="coach-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, opacity: 0.7 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11,
                        background: '#FCF2DE', color: '#A37416',
                        fontWeight: 700, fontSize: 14,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        {initials || emailInitial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233' }}>
                          {fullName || inv.invited_email}
                        </div>
                        {fullName && <div style={{ fontSize: 12, color: '#8A9AB0' }}>{inv.invited_email}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#A37416', background: '#FCF2DE', padding: '4px 9px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Oczekuje
                      </span>
                      <button
                        onClick={async () => {
                          await supabase.from('team_invites').update({ status: 'revoked' }).eq('id', inv.id)
                          loadRoster()
                        }}
                        className="coach-btn-ghost"
                        style={{ fontSize: 12, padding: '6px 10px', color: '#D85546' }}
                      >Anuluj</button>
                    </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InvitePlayerModal
          team={currentTeam}
          coachId={user.id}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadRoster() }}
        />
      )}
    </div>
  )
}

function InvitePlayerModal({ team, coachId, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Podaj email zawodnika.')
      return
    }
    setSubmitting(true)

    try {
      const emailLower = email.trim().toLowerCase()

      // 1. Try to resolve email to existing player profile
      const { data: matchingProfile } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', emailLower)
        .maybeSingle()

      // 2. Insert invite (imię/nazwisko są opcjonalne — trener uzupełnia później)
      const { data: invite, error: inviteErr } = await supabase
        .from('team_invites')
        .insert({
          team_id: team.id,
          invited_email: emailLower,
          invited_first_name: firstName.trim() || null,
          invited_last_name: lastName.trim() || null,
          invited_player_id: matchingProfile?.id || null,
          invited_by: coachId,
        })
        .select()
        .single()

      if (inviteErr) {
        if (inviteErr.code === '23505') {
          setError('Ten email ma już aktywne zaproszenie do tej drużyny.')
        } else {
          setError(inviteErr.message)
        }
        setSubmitting(false)
        return
      }

      // 3. If we resolved a player, create an in-app notification
      if (matchingProfile?.id) {
        await supabase.from('notifications').insert({
          user_id: matchingProfile.id,
          type: 'team_invite',
          payload: {
            invite_id: invite.id,
            team_id: team.id,
            team_name: team.name,
            coach_label: `${firstName.trim()} ${lastName.trim()}`,
          },
          action_url: `/invites/${invite.id}`,
        })
      }

      onInvited()
    } catch (err) {
      setError(err?.message || 'Nie udało się wysłać zaproszenia.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20, 35, 60, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 200,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF',
        width: '100%', maxWidth: 460,
        borderRadius: 18,
        padding: 28,
      }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Dodaj zawodnika</h2>
        <p className="coach-subtitle" style={{ marginBottom: 20 }}>
          Wystarczy email. Imię i nazwisko możesz uzupełnić później na profilu zawodnika.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Email zawodnika *</label>
            <input
              className="coach-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="zawodnik@email.pl"
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="coach-label">Imię (opcjonalne)</label>
              <input className="coach-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="coach-label">Nazwisko (opcjonalne)</label>
              <input className="coach-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          {error && <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={onClose} className="coach-btn-secondary" style={{ flex: 1 }}>Anuluj</button>
            <button type="submit" className="coach-btn-primary" disabled={submitting} style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
