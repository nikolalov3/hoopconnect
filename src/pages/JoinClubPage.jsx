import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const POS_LABEL = {
  PG: 'Rozgrywający',
  SG: 'Rzucający',
  SF: 'Skrzydłowy',
  C:  'Środkowy',
  PF: 'Silny skrzydłowy',
}
const POS_COLOR = {
  PG: '#4A80FF', SG: '#00C880', SF: '#FF8830', C: '#9050FF', PF: '#FF4070',
}
const POSITIONS = ['PG', 'SG', 'SF', 'C', 'PF']

function Badge({ abbr = '?', size = 72 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ overflow: 'visible', filter: 'drop-shadow(0 8px 24px rgba(0,160,255,0.55))' }}>
      <defs>
        <linearGradient id="jbdgG" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#66CCFF"/>
          <stop offset="45%"  stopColor="#1A78D0"/>
          <stop offset="100%" stopColor="#061640"/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.35)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#jbdgG)"/>
      <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.30)"/>
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.13)"/>
      <polygon points="8,32 8,58 45,48 45,42"  fill="rgba(0,80,200,.55)"/>
      <polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,20,90,.70)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="45" y="51" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '23'} fontWeight="900"
        fontFamily="var(--font-display),sans-serif" letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

export default function JoinClubPage() {
  const { clubId }         = useParams()
  const [params]           = useSearchParams()
  const navigate           = useNavigate()
  const { user, profile }  = useAuth()

  const invitedPos = (params.get('pos') || '').toUpperCase()

  const [club,    setClub]    = useState(null)
  const [members, setMembers] = useState({}) // pos → true/false
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [joining, setJoining] = useState(false)
  const [done,    setDone]    = useState(false)
  const [selPos,  setSelPos]  = useState(POSITIONS.includes(invitedPos) ? invitedPos : null)

  /* ── 1. If not logged in → save returnTo, go to auth ── */
  useEffect(() => {
    if (!user) {
      localStorage.setItem('hc_returnTo', `/dolacz/${clubId}${params.toString() ? `?${params}` : ''}`)
      navigate('/auth', { replace: true })
    }
  }, [user])

  /* ── 2. Fetch club info ── */
  useEffect(() => {
    if (!user) return
    async function load() {
      setLoading(true)
      const { data: clubRow } = await supabase
        .from('clubs')
        .select('id,name,abbr,country_code,country_name,country_flag,owner_id')
        .eq('id', clubId)
        .maybeSingle()

      if (!clubRow) { setError('Nie znaleziono klubu.'); setLoading(false); return }

      const { data: rows } = await supabase
        .from('club_members')
        .select('position,user_id')
        .eq('club_id', clubId)

      const taken = {}
      for (const r of rows ?? []) taken[r.position] = r.user_id

      setClub(clubRow)
      setMembers(taken)

      // If invited position is taken, clear selection so user picks another
      if (selPos && taken[selPos]) setSelPos(null)

      setLoading(false)
    }
    load()
  }, [user, clubId])

  /* ── 3. Join ── */
  async function handleJoin() {
    if (!selPos || !club || !user || joining) return
    setJoining(true)
    setError(null)

    // Check user not already in a club
    const { data: existing } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      setError('Jesteś już członkiem innego klubu.')
      setJoining(false)
      return
    }

    // Ensure profile exists (trigger might be broken on some accounts)
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!prof) {
      await supabase.from('profiles').insert({ id: user.id, name: user.email?.split('@')[0] ?? 'Gracz' })
    }

    const { error: insErr } = await supabase
      .from('club_members')
      .insert({ club_id: club.id, user_id: user.id, position: selPos })

    if (insErr) { setError(insErr.message); setJoining(false); return }

    setDone(true)
    setTimeout(() => navigate('/club', { replace: true }), 1400)
  }

  /* ── Already in this club ── */
  const alreadyMember = user && Object.values(members).includes(user.id)

  /* ── UI ── */
  if (!user) return null

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 22px 48px',
      background: 'transparent',
    }}>
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="load"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </motion.div>

        ) : error && !club ? (
          <motion.div key="err"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 48, marginBottom: 12 }}>🏀</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 22, color: 'var(--text-primary)', marginBottom: 8 }}>
              Ups!
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{error}</p>
            <button className="btn-primary" onClick={() => navigate('/')}
              style={{ marginTop: 24, width: '100%' }}>
              Wróć do aplikacji
            </button>
          </motion.div>

        ) : done ? (
          <motion.div key="done"
            initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
            style={{ textAlign: 'center' }}>
            <motion.p
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              style={{ fontSize: 64, marginBottom: 16 }}>✅</motion.p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 28, color: 'var(--text-primary)', textTransform: 'uppercase',
              letterSpacing: 1 }}>
              Dołączyłeś!
            </p>
            <p style={{ color: 'var(--text-dim)', marginTop: 8, fontSize: 13 }}>
              Przekierowanie do klubu…
            </p>
          </motion.div>

        ) : (
          <motion.div key="main"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            style={{ width: '100%', maxWidth: 380 }}>

            {/* Club card */}
            <div style={{
              background: 'rgba(6,18,38,0.58)',
              backdropFilter: 'blur(32px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
              border: '1px solid rgba(120,190,255,0.12)',
              borderTop: '1px solid rgba(160,210,255,0.22)',
              borderRadius: 20,
              padding: '24px 20px 20px',
              marginBottom: 20,
              boxShadow: '0 8px 32px rgba(0,0,0,0.40)',
            }}>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                letterSpacing: 2.5, textTransform: 'uppercase',
                color: 'var(--text-dim)', marginBottom: 14, textAlign: 'center',
              }}>
                Zaproszenie do klubu
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <Badge abbr={club.abbr} size={64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                    letterSpacing: 2.5, textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 3,
                  }}>
                    {club.country_flag}&nbsp;{club.country_name}
                  </p>
                  <h1 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 900,
                    fontSize: 22, textTransform: 'uppercase',
                    color: 'var(--text-primary)', margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {club.name.toUpperCase()}
                  </h1>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                    letterSpacing: 1.5, textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginTop: 5,
                  }}>
                    {Object.keys(members).length}/5 graczy
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'rgba(120,190,255,0.08)', margin: '0 0 16px' }} />

              {/* Already a member */}
              {alreadyMember ? (
                <div style={{
                  padding: '12px 16px', borderRadius: 12, textAlign: 'center',
                  background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.22)',
                }}>
                  <p style={{ fontSize: 13, color: 'var(--green-shot)', fontWeight: 600 }}>
                    Jesteś już członkiem tego klubu
                  </p>
                  <button className="btn-primary" onClick={() => navigate('/club')}
                    style={{ marginTop: 12, width: '100%' }}>
                    Przejdź do klubu
                  </button>
                </div>
              ) : (
                <>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
                    letterSpacing: 2, textTransform: 'uppercase',
                    color: 'var(--text-dim)', marginBottom: 10,
                  }}>
                    Wybierz pozycję
                  </p>

                  {/* Position picker */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                    {POSITIONS.map(pos => {
                      const taken  = !!members[pos]
                      const active = selPos === pos
                      const col    = POS_COLOR[pos]
                      return (
                        <motion.button key={pos}
                          whileTap={taken ? {} : { scale: 0.97 }}
                          onClick={() => !taken && setSelPos(pos)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '11px 14px', borderRadius: 12,
                            border: active
                              ? `1.5px solid ${col}80`
                              : taken
                              ? '1px solid rgba(255,255,255,0.05)'
                              : '1px solid rgba(120,190,255,0.10)',
                            background: active
                              ? `${col}15`
                              : taken
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(6,18,38,0.40)',
                            cursor: taken ? 'not-allowed' : 'pointer',
                            opacity: taken ? 0.45 : 1,
                            transition: 'all 0.15s',
                          }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                            background: active ? `${col}25` : 'rgba(255,255,255,0.06)',
                            border: active ? `1px solid ${col}50` : '1px solid rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 900,
                            color: active ? col : 'var(--text-dim)', letterSpacing: 0.5,
                          }}>{pos}</div>
                          <div style={{ flex: 1 }}>
                            <p style={{
                              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
                              color: active ? col : taken ? 'var(--text-dim)' : 'var(--text-primary)',
                              margin: 0,
                            }}>{POS_LABEL[pos]}</p>
                          </div>
                          {taken && (
                            <span style={{ fontSize: 10, color: 'var(--text-dim)',
                              fontWeight: 600, letterSpacing: 1 }}>ZAJĘTE</span>
                          )}
                          {active && !taken && (
                            <motion.div
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              style={{ width: 8, height: 8, borderRadius: '50%',
                                background: col, boxShadow: `0 0 8px ${col}` }} />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>

                  {error && (
                    <p style={{ color: 'var(--red-shot)', fontSize: 12,
                      textAlign: 'center', marginBottom: 12 }}>{error}</p>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleJoin}
                    disabled={!selPos || joining}
                    className="btn-primary"
                    style={{ opacity: selPos && !joining ? 1 : 0.35 }}>
                    {joining ? 'Dołączanie…' : selPos ? `Dołącz jako ${selPos}` : 'Wybierz pozycję'}
                  </motion.button>
                </>
              )}
            </div>

            <button onClick={() => navigate('/')}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                color: 'var(--text-dim)', fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
              }}>
              Anuluj
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
