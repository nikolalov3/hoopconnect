import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'

/**
 * Floating 'Zgłoś / Zapytaj' button in the bottom-right of every coach panel
 * page. One simple form, one row in `coach_feedback` per submission.
 * Designed for beta-testing trainers to drop anything that bugs them or
 * questions they have without leaving the app.
 */
export default function FeedbackButton() {
  const { user, coachProfile } = useCoachAuth()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState(coachProfile?.email || user?.email || '')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  // Keep email in sync if profile loads after the modal was opened
  if (!email && (coachProfile?.email || user?.email)) {
    setEmail(coachProfile?.email || user?.email || '')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!message.trim()) { setError('Wpisz wiadomość.'); return }
    setError(null); setSubmitting(true)
    const { error } = await supabase.from('coach_feedback').insert({
      coach_id:    user?.id || null,
      email:       email.trim() || null,
      message:     message.trim(),
      context_url: typeof window !== 'undefined' ? window.location.href : null,
    })
    setSubmitting(false)
    if (error) { setError(error.message); return }
    setSent(true)
    setMessage('')
    setTimeout(() => { setOpen(false); setSent(false) }, 1800)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Zgłoś / Zapytaj"
        style={{
          position: 'fixed',
          right: 20, bottom: 20,
          zIndex: 60,
          background: '#5591CD',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 99,
          padding: '12px 18px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(85,145,205,0.32), 0 2px 6px rgba(20,35,60,0.18)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'inherit',
        }}>
        <span style={{ fontSize: 16 }}>💬</span>
        <span>Zgłoś / Zapytaj</span>
      </button>

      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 220,
          background: 'rgba(20,35,60,0.4)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
          padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF',
            width: '100%', maxWidth: 420,
            borderRadius: 18,
            padding: '24px 24px 20px',
            boxShadow: '0 24px 64px rgba(20,35,60,0.32)',
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 className="coach-h2" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💬</span>
                Zgłoś / Zapytaj
              </h2>
              <button onClick={() => setOpen(false)} style={{
                background: 'transparent', border: 'none', color: '#8A9AB0',
                fontSize: 22, cursor: 'pointer', lineHeight: 1,
              }}>×</button>
            </div>
            <p className="coach-subtitle" style={{ marginBottom: 16 }}>
              Cokolwiek nie działa, brakuje, denerwuje — albo pomysł na nowy feature. Każda wiadomość trafia do mnie.
            </p>

            {sent ? (
              <div style={{
                padding: '20px 16px', textAlign: 'center', borderRadius: 12,
                background: '#E2F4EB', border: '1px solid #9CD9B7', color: '#1E6B3D',
                fontSize: 14, fontWeight: 600,
              }}>
                ✓ Dzięki! Wiadomość dotarła.
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label className="coach-label">Twoja wiadomość *</label>
                  <textarea
                    className="coach-input"
                    rows="5"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Co chciałbyś zgłosić lub zapytać?"
                    autoFocus
                    required
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label className="coach-label">Email (żebym mógł odpowiedzieć)</label>
                  <input
                    className="coach-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="trener@klub.pl"
                  />
                </div>

                {error && (
                  <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
                    {error}
                  </div>
                )}

                <button type="submit" className="coach-btn-primary" disabled={submitting}>
                  {submitting ? 'Wysyłanie...' : 'Wyślij'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
