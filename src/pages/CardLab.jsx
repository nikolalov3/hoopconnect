/**
 * CardLab — dev-only sandbox to visualise the settings OVERLAY IN CONTEXT.
 * Public route /cardlab, renders only on localhost so it never ships live.
 *
 * Settings is an OVERLAY over the main menu: the home shows through, blurred
 * (glass). The card hangs on top, ✕ closes (top-right), an edit affordance sits
 * by the e-mail, and the settings panel sits just below the card (tight spacing).
 * Tapping edit swaps that panel in place for the background/frame picker.
 * (The blurred "home" below is a mock so we can see the glass effect in the lab.)
 */
import { useState } from 'react'
import PlayerCard3D from '../components/ui/PlayerCard3D'
import HexAvatar from '../components/ui/HexAvatar'
import { FRAME_CATALOG } from '../lib/frames'

const BACKGROUNDS = [
  { id: 'bg_dragon', name: 'Rok Smoka', asset: '/cardlab/dragon.png' },
]
const FRAMES = FRAME_CATALOG.map(f => ({ id: f.id, name: f.id }))

const CARD = { name: 'Nikola Love', hcId: 14444, arenaLevel: 5, xp: 4200, matchWins: 12, kotcWins: 3 }
const C = { surface: 'rgba(10,20,38,0.5)', border: 'rgba(150,200,255,0.12)', text: '#EAF2FF', sub: '#8399b5', accent: '#5BB8F5' }
const HOME_BG = `
  radial-gradient(ellipse 80% 45% at 50% -5%, rgba(91,184,245,0.22) 0%, transparent 60%),
  radial-gradient(ellipse 60% 45% at 108% 30%, rgba(91,184,245,0.14) 0%, transparent 60%),
  linear-gradient(170deg, #0C1F38 0%, #091828 42%, #060F1E 100%)`

const row = { display: 'flex', gap: 12, overflowX: 'auto', padding: '2px 20px 6px', WebkitOverflowScrolling: 'touch' }
const secLbl = { fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6f8dab', fontWeight: 700, margin: '0 0 10px', padding: '0 20px' }

// Mock of the main menu behind the glass — lab-only, so the overlay has something
// real to blur. In the app this is the actual Home screen.
function FauxHome() {
  return (
    <div style={{ position: 'absolute', inset: 0, background: HOME_BG, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ padding: '58px 22px 0' }}>
        <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40, letterSpacing: 0, color: 'rgba(234,242,255,0.92)', textTransform: 'uppercase' }}>Cześć, Nikola</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 26 }}>
        <div style={{ width: 190, height: 190, borderRadius: 44, transform: 'rotate(45deg)',
          border: '11px solid rgba(120,200,255,0.42)', boxShadow: '0 0 40px rgba(91,184,245,0.35)' }}/>
      </div>
      <div style={{ padding: '46px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ height: 92, borderRadius: 18, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(150,200,255,0.1)' }}/>
        ))}
      </div>
    </div>
  )
}

function Tile({ selected, label, onClick, children }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ borderRadius: 12, padding: 3, border: `2px solid ${selected ? C.accent : 'rgba(150,200,255,0.12)'}`,
        boxShadow: selected ? '0 0 16px rgba(91,184,245,0.5)' : 'none' }}>{children}</div>
      <span style={{ fontSize: 10, fontWeight: 700, color: selected ? '#dbeeff' : C.sub, maxWidth: 92,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
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

const iconBtn = {
  width: 38, height: 38, borderRadius: '50%', cursor: 'pointer',
  background: 'rgba(10,20,38,0.5)', border: '1px solid rgba(150,200,255,0.22)',
  color: '#cfe0f2', display: 'flex', alignItems: 'center', justifyContent: 'center',
  WebkitTapHighlightColor: 'transparent', backdropFilter: 'blur(8px)',
}

export default function CardLab() {
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const [bg, setBg]           = useState('bg_dragon')
  const [frame, setFrame]     = useState('early_access')
  const [editing, setEditing] = useState(false)

  if (!isDev) return <div style={{ padding: 40, color: '#889', textAlign: 'center' }}>CardLab is dev-only.</div>

  const bgAsset = BACKGROUNDS.find(b => b.id === bg)?.asset ?? null

  return (
    <div style={{ position: 'relative', minHeight: '100%', overflow: 'hidden' }}>
      <FauxHome/>

      {/* Glass overlay — blurs the home behind it */}
      <div style={{ position: 'relative', minHeight: '100%', overflowY: 'auto', paddingBottom: 44,
        background: 'rgba(6,13,26,0.28)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' }}>

        <button aria-label="Zamknij" style={{ ...iconBtn, position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>

        {/* Card hero */}
        <div style={{ paddingTop: 46, display: 'flex', justifyContent: 'center' }}>
          <PlayerCard3D {...CARD} frameVariant={frame || 'none'} background={bgAsset} scale={0.72} idle/>
        </div>

        {/* e-mail + edit affordance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12 }}>
          <p style={{ fontSize: 12, color: C.sub, margin: 0 }}>nikolalovexo@gmail.com</p>
          <button onClick={() => setEditing(e => !e)} aria-label="Edytuj kartę"
            style={{ ...iconBtn, width: 30, height: 30,
              background: editing ? 'rgba(120,190,255,0.3)' : 'rgba(120,190,255,0.16)',
              border: `1px solid ${editing ? 'rgba(150,200,255,0.6)' : 'rgba(150,200,255,0.3)'}`, color: '#dbeeff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
        </div>

        {/* Panel — tight under the card */}
        <div style={{ marginTop: 26 }}>
          {editing ? (
            <div>
              <p style={secLbl}>Tło karty</p>
              <div className="hide-scrollbar" style={{ ...row, marginBottom: 18 }}>
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
              <div style={{ padding: '16px 20px 0' }}>
                <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a6b82', fontSize: 12, fontWeight: 600, padding: '4px 0', fontFamily: 'inherit' }}>Masz kod? →</button>
              </div>
              <div style={{ padding: '14px 20px 0' }}>
                <button onClick={() => setEditing(false)} style={{ width: '100%', padding: '15px', borderRadius: 12, cursor: 'pointer', border: 'none',
                  background: 'linear-gradient(135deg, #1E6BB0, #5BB8F5)', color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: 0.5, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>Zapisz</button>
              </div>
            </div>
          ) : (
            <div style={{ padding: '0 18px' }}>
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
                <Row label="Ustawienia konta" sub="Email · Hasło · Usuń konto"/>
                <Row label="Profil" sub="Imię · Miasto · Dni treningu" divider/>
                <Row label="Język" sub="Polski" divider/>
                <Row label="Informacje" sub="Polityka · Regulamin · Kontakt" divider/>
              </div>
              <div style={{ textAlign: 'center', padding: '22px 0 8px' }}>
                <span style={{ color: '#ff5a5f', fontSize: 12, fontWeight: 600 }}>Wyloguj się</span>
                <p style={{ fontSize: 8.5, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5a6b82', fontWeight: 600, margin: '10px 0 0' }}>HoopConnect · 1.3.33</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
