/**
 * CardLab — dev-only sandbox to visualise profile-card customization IN CONTEXT.
 * Public route /cardlab, renders only on localhost so it never ships live.
 *
 * Layout mirrors the real Settings: card hero stays pinned at the top (with a
 * gentle idle sway); the small personalization symbol under it swaps ONLY the
 * lower section between the normal account menu and the card+frame picker
 * (+ Zapisz). No full-screen view, no "Personalizacja" title.
 */
import { useState } from 'react'
import PlayerCard3D from '../components/ui/PlayerCard3D'
import HexAvatar from '../components/ui/HexAvatar'
import { FRAME_CATALOG } from '../lib/frames'

const BACKGROUNDS = [
  { id: 'bg_dragon', name: 'Różowy Smok', asset: '/cardlab/dragon.png' },
  { id: 'bg_nebula', name: 'Mgławica',    asset: '/cardlab/placeholder.svg' },
]
const FRAMES = FRAME_CATALOG.map(f => ({ id: f.id, name: f.id }))

const CARD = { name: 'Nikola Love', hcId: 14444, arenaLevel: 5, xp: 4200, matchWins: 12, kotcWins: 3 }
const C = { bg: '#0A1420', surface: 'rgba(255,255,255,0.03)', border: 'rgba(150,200,255,0.1)', text: '#EAF2FF', sub: '#8399b5', accent: '#5BB8F5' }

const row = { display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 20px 6px', WebkitOverflowScrolling: 'touch' }
const secLbl = { fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6f8dab', fontWeight: 700, margin: '0 0 10px', padding: '0 20px' }

function Tile({ selected, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{
        borderRadius: 12, padding: 3,
        border: `2px solid ${selected ? C.accent : 'rgba(150,200,255,0.12)'}`,
        boxShadow: selected ? '0 0 16px rgba(91,184,245,0.5)' : 'none', transition: 'border-color .15s, box-shadow .15s',
      }}>{children}</div>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.3, color: selected ? '#dbeeff' : C.sub,
        maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

function Row({ label, sub, divider }) {
  return (
    <div style={{ padding: '15px 16px', borderTop: divider ? `1px solid ${C.border}` : 'none',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <p style={{ margin: 0, color: C.text, fontSize: 14, fontWeight: 700 }}>{label}</p>
        {sub && <p style={{ margin: '2px 0 0', color: C.sub, fontSize: 11 }}>{sub}</p>}
      </div>
      <span style={{ color: C.sub }}>›</span>
    </div>
  )
}

export default function CardLab() {
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const [bg, setBg]         = useState('bg_dragon')
  const [frame, setFrame]   = useState('early_access')
  const [editing, setEditing] = useState(false)

  if (!isDev) return <div style={{ padding: 40, color: '#889', textAlign: 'center' }}>CardLab is dev-only.</div>

  const bgAsset = BACKGROUNDS.find(b => b.id === bg)?.asset ?? null

  return (
    <div style={{ minHeight: '100%', background: C.bg, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', margin: '12px auto 0' }}/>

      {/* Card hero — pinned, gentle idle sway */}
      <div style={{ padding: '18px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <PlayerCard3D {...CARD} frameVariant={frame || 'none'} background={bgAsset} scale={0.72} idle/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          <p style={{ fontSize: 12, color: C.sub, margin: 0 }}>nikolalovexo@gmail.com</p>
          <button onClick={() => setEditing(e => !e)} aria-label="Personalizacja karty" style={{
            width: 30, height: 30, borderRadius: '50%', cursor: 'pointer',
            background: editing ? 'rgba(120,190,255,0.32)' : 'rgba(120,190,255,0.16)',
            border: `1px solid ${editing ? 'rgba(150,200,255,0.6)' : 'rgba(150,200,255,0.35)'}`,
            color: '#dbeeff', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 4.6 4.9.4-3.7 3.2 1.1 4.8L12 13.9 7.7 16l1.1-4.8L5.1 8l4.9-.4L12 3z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Lower section — swaps between the account menu and the picker */}
      {!editing ? (
        <>
          <div style={{ padding: '22px 20px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#7289DA">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, color: C.text, fontWeight: 700, fontSize: 14 }}>Dołącz na Discord</p>
                <p style={{ margin: '2px 0 0', color: C.sub, fontSize: 11 }}>Społeczność HoopConnect</p>
              </div>
              <span style={{ color: C.sub }}>›</span>
            </div>
          </div>

          <div style={{ padding: '22px 20px 0' }}>
            <p style={secLbl}>Konto</p>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <Row label="Ustawienia konta" sub="Email · Hasło · Usuń konto"/>
              <Row label="Język" sub="Polski" divider/>
            </div>
          </div>

          <div style={{ padding: '18px 20px 0' }}>
            <p style={secLbl}>Inne</p>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden' }}>
              <Row label="Informacje" sub="Polityka · Regulamin · Kontakt"/>
            </div>
          </div>

          <div style={{ padding: '26px 20px 44px', textAlign: 'center' }}>
            <span style={{ color: '#ff5a5f', fontSize: 12, fontWeight: 600 }}>Wyloguj się</span>
            <p style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5a6b82', fontWeight: 600, margin: '10px 0 0' }}>HoopConnect · 1.3.33</p>
          </div>
        </>
      ) : (
        <div style={{ padding: '24px 0 44px' }}>
          <p style={secLbl}>Tło karty</p>
          <div className="hide-scrollbar" style={{ ...row, marginBottom: 20 }}>
            {BACKGROUNDS.map(b => (
              <Tile key={b.id} label={b.name} selected={bg === b.id} onClick={() => setBg(bg === b.id ? null : b.id)}>
                <PlayerCard3D {...CARD} background={b.asset} scale={0.26} interactive={false} blank/>
              </Tile>
            ))}
          </div>

          <p style={secLbl}>Ramka</p>
          <div className="hide-scrollbar" style={row}>
            {FRAMES.map(f => (
              <Tile key={f.id} label={f.name} selected={frame === f.id} onClick={() => setFrame(frame === f.id ? null : f.id)}>
                <div style={{ width: 66, height: 66, borderRadius: 10, background: 'rgba(10,20,38,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HexAvatar name={CARD.name} variant={f.id} size={52} noAnim/>
                </div>
              </Tile>
            ))}
          </div>

          <div style={{ padding: '26px 20px 0' }}>
            <button onClick={() => setEditing(false)} style={{
              width: '100%', padding: '15px', borderRadius: 12, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #1E6BB0, #5BB8F5)', color: '#fff',
              fontWeight: 800, fontSize: 14, letterSpacing: 0.5, fontFamily: 'var(--font-display)',
              textTransform: 'uppercase', WebkitTapHighlightColor: 'transparent',
            }}>Zapisz</button>
          </div>
        </div>
      )}
    </div>
  )
}
