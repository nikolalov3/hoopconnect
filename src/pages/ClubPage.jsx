import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'hc_club_v1'

const COUNTRIES = [
  { code: 'PL', name: 'Polska',           flag: '🇵🇱' },
  { code: 'US', name: 'USA',              flag: '🇺🇸' },
  { code: 'DE', name: 'Niemcy',           flag: '🇩🇪' },
  { code: 'FR', name: 'Francja',          flag: '🇫🇷' },
  { code: 'ES', name: 'Hiszpania',        flag: '🇪🇸' },
  { code: 'IT', name: 'Włochy',           flag: '🇮🇹' },
  { code: 'GB', name: 'Wielka Brytania',  flag: '🇬🇧' },
  { code: 'PT', name: 'Portugalia',       flag: '🇵🇹' },
  { code: 'BR', name: 'Brazylia',         flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria',          flag: '🇳🇬' },
  { code: 'LT', name: 'Litwa',            flag: '🇱🇹' },
  { code: 'RS', name: 'Serbia',           flag: '🇷🇸' },
  { code: 'HR', name: 'Chorwacja',        flag: '🇭🇷' },
  { code: 'GR', name: 'Grecja',           flag: '🇬🇷' },
  { code: 'AU', name: 'Australia',        flag: '🇦🇺' },
  { code: 'CA', name: 'Kanada',           flag: '🇨🇦' },
]

// 5 pozycji w formacji — 2 górne + 3 dolne (jak Sorare)
const POSITIONS = [
  { key: 'PG', label: 'Rozgrywający', row: 0 },
  { key: 'SG', label: 'Rzucający',    row: 0 },
  { key: 'SF', label: 'Skrzydłowy',   row: 1 },
  { key: 'C',  label: 'Środkowy',     row: 1, isCenter: true },
  { key: 'PF', label: 'Silny skrzydł.',row: 1 },
]

function loadClub() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}
function saveClub(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function DiamondBadge({ abbr = '?', size = 70, glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id="badgeGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#7BC8F8" />
          <stop offset="40%"  stopColor="#5BB8F5" />
          <stop offset="100%" stopColor="#1B3A6B" />
        </linearGradient>
        {glow && (
          <filter id="badgeGlow">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feComposite in="SourceGraphic" in2="blur" operator="over"/>
          </filter>
        )}
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.22)" />
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#badgeGrad)" />
      <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,0.30)" />
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.13)" />
      <polygon points="8,32 8,58 45,48 45,42"  fill="rgba(40,130,220,0.80)" />
      <polygon points="82,32 82,58 45,48 45,42" fill="rgba(14,70,150,0.90)" />
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinejoin="round" />
      <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? "20" : "24"} fontWeight="900"
        fontFamily="var(--font-display), Montserrat, 'Arial Black', sans-serif"
        letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER SLOT ───────────────────────────────────────────────────────────────
function PlayerSlot({ position, member, isCenter, onPress }) {
  const size = isCenter ? 82 : 70

  if (member) {
    return (
      <motion.button whileTap={{ scale: 0.93 }} onClick={onPress}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {/* Filled diamond — shows player initial */}
        <svg width={size} height={size} viewBox="0 0 90 90" style={{ overflow: 'visible' }}>
          <defs>
            <linearGradient id={`pg${position.key}`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%"   stopColor="#2272C3" />
              <stop offset="100%" stopColor="#0D2A5A" />
            </linearGradient>
          </defs>
          <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.30)" />
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill={`url(#pg${position.key})`} />
          <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,0.20)" />
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
            fill="none" stroke="rgba(91,184,245,0.60)" strokeWidth="2" strokeLinejoin="round" />
          {/* Pulse ring */}
          <polygon points="45,4 84,31 84,59 45,86 6,59 6,31"
            fill="none" stroke="rgba(91,184,245,0.25)" strokeWidth="1" strokeLinejoin="round" />
          <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="30" fontWeight="800"
            fontFamily="var(--font-display), Montserrat, sans-serif">
            {member.initial}
          </text>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5BB8F5', margin: 0 }}>
            {position.key}
          </p>
          <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.80)', margin: '2px 0 0', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </p>
        </div>
      </motion.button>
    )
  }

  // Empty slot
  return (
    <motion.button whileTap={{ scale: 0.92 }} onClick={onPress}
      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} viewBox="0 0 90 90" style={{ overflow: 'visible' }}>
        {/* Dashed diamond outline */}
        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
          fill="rgba(91,184,245,0.05)"
          stroke="rgba(91,184,245,0.35)" strokeWidth="2" strokeLinejoin="round"
          strokeDasharray="6 4" />
        {/* Plus icon */}
        <line x1="45" y1="36" x2="45" y2="54" stroke="rgba(91,184,245,0.70)" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="36" y1="45" x2="54" y2="45" stroke="rgba(91,184,245,0.70)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(91,184,245,0.60)', margin: 0 }}>
          {position.key}
        </p>
        <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.30)', margin: '2px 0 0' }}>
          Zaproś
        </p>
      </div>
    </motion.button>
  )
}

// ── INVITE MODAL ──────────────────────────────────────────────────────────────
function InviteModal({ club, position, member, onClose, onRemove }) {
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${position.key}`

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(4,2,0,0.78)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 32px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          margin: '0 16px',
          background: 'rgba(10,14,22,0.97)',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(91,184,245,0.20)',
          borderTop: '1px solid rgba(91,184,245,0.40)',
          borderRadius: 24,
          padding: '24px 24px 20px',
          boxShadow: '0 -4px 50px rgba(0,0,0,0.60)',
        }}
      >
        <div style={{ width: 36, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 20px' }} />

        {member ? (
          <>
            <p style={{ fontSize: 11, letterSpacing: 2, color: '#5BB8F5', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Zawodnik · {position.key}
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
              {member.name}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 24 }}>{position.label}</p>
            <button onClick={onRemove} style={{
              width: '100%', padding: '13px',
              background: 'rgba(255,59,48,0.10)', border: '1px solid rgba(255,59,48,0.30)',
              borderRadius: 12, color: '#FF3B30', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 14, letterSpacing: 1, cursor: 'pointer',
            }}>
              Usuń z klubu
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, letterSpacing: 2, color: '#5BB8F5', textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Zaproś zawodnika
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
              Pozycja: {position.key}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>{position.label}</p>

            {/* Link box */}
            <div style={{
              padding: '12px 14px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
              marginBottom: 12, fontFamily: 'monospace', fontSize: 11,
              color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all',
            }}>
              {link}
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={copyLink} style={{
              width: '100%', padding: '14px',
              background: copied ? 'rgba(0,230,118,0.12)' : 'rgba(91,184,245,0.15)',
              border: copied ? '1px solid rgba(0,230,118,0.35)' : '1px solid rgba(91,184,245,0.35)',
              borderRadius: 12,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: 1,
              color: copied ? '#00E676' : '#5BB8F5',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {copied ? '✓ Skopiowano!' : '🔗 Kopiuj link zaproszenia'}
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── COUNTRY PICKER MODAL ──────────────────────────────────────────────────────
function CountryPicker({ value, onChange, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(4,2,0,0.80)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 24px',
      }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 12px',
          background: 'rgba(10,14,22,0.98)',
          border: '1px solid rgba(91,184,245,0.20)',
          borderTop: '1px solid rgba(91,184,245,0.40)',
          borderRadius: 24,
          maxHeight: '60vh', overflowY: 'auto',
          padding: '20px 0 16px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <p style={{ fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: '#5BB8F5', fontWeight: 700, margin: '0 20px 16px', textAlign: 'center' }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => { onChange(c); onClose(); }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 20px',
              background: value?.code === c.code ? 'rgba(91,184,245,0.12)' : 'transparent',
              border: 'none', cursor: 'pointer',
              borderLeft: value?.code === c.code ? '3px solid #5BB8F5' : '3px solid transparent',
            }}
          >
            <span style={{ fontSize: 24 }}>{c.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: value?.code === c.code ? '#5BB8F5' : 'rgba(255,255,255,0.80)' }}>
              {c.name}
            </span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: '#5BB8F5', fontSize: 14 }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── CREATION SCREEN ───────────────────────────────────────────────────────────
function CreateClub({ onCreated, ownerName, ownerInitial }) {
  const [name, setName]       = useState('')
  const [abbr, setAbbr]       = useState('')
  const [country, setCountry] = useState(COUNTRIES[0])
  const [showPicker, setShowPicker] = useState(false)
  const [step, setStep]       = useState(0) // 0=form, 1=confirm

  function handleCreate() {
    if (!name.trim() || abbr.length < 2) return
    const club = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim(),
      abbr: abbr.toUpperCase().slice(0, 3),
      country,
      createdAt: new Date().toISOString(),
      members: {
        PG: { name: ownerName, initial: ownerInitial, isOwner: true },
        SG: null, SF: null, C: null, PF: null,
      },
    }
    saveClub(club)
    onCreated(club)
  }

  const preview = abbr.trim().toUpperCase().slice(0, 3) || '?'
  const valid = name.trim().length >= 3 && abbr.trim().length >= 2

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      padding: '48px 24px 40px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(91,184,245,0.20) 0%, transparent 60%)',
      }} />

      <AnimatePresence>
        {showPicker && <CountryPicker value={country} onChange={setCountry} onClose={() => setShowPicker(false)} />}
      </AnimatePresence>

      {/* Badge preview */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}
      >
        <DiamondBadge abbr={preview} size={90} />
        <p style={{ fontSize: 9, letterSpacing: 3, color: '#5BB8F5', textTransform: 'uppercase', fontWeight: 700, marginTop: 12 }}>
          Podgląd odznaki
        </p>
      </motion.div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36,
        textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.1,
        color: 'var(--text-primary)', marginBottom: 8,
      }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 32, lineHeight: 1.5 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie razem.
      </p>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Club name */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#A0B0C8', marginBottom: 6 }}>
            Nazwa klubu
          </p>
          <input
            className="input-field"
            placeholder="np. Hoopconnect Warsaw"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            style={{ fontSize: 16 }}
          />
        </div>

        {/* Abbreviation */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#A0B0C8', marginBottom: 6 }}>
            Skrót (2–3 litery)
          </p>
          <input
            className="input-field"
            placeholder="np. HCW"
            value={abbr}
            onChange={e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
            maxLength={3}
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'var(--font-display)' }}
          />
        </div>

        {/* Country */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: '#A0B0C8', marginBottom: 6 }}>
            Kraj
          </p>
          <button onClick={() => setShowPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 24 }}>{country.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{country.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255,255,255,0.30)" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Create button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleCreate}
        disabled={!valid}
        style={{
          marginTop: 32,
          width: '100%', padding: '16px',
          background: valid ? 'linear-gradient(135deg, #3A9FE0, #1B5CAD)' : 'rgba(255,255,255,0.07)',
          border: valid ? '1px solid rgba(91,184,245,0.40)' : '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
          letterSpacing: 2, textTransform: 'uppercase',
          color: valid ? '#fff' : 'rgba(255,255,255,0.25)',
          cursor: valid ? 'pointer' : 'default',
          transition: 'all 0.2s',
          boxShadow: valid ? '0 4px 24px rgba(91,184,245,0.30)' : 'none',
        }}
      >
        Utwórz Klub
      </motion.button>
    </div>
  )
}

// ── CLUB PANEL ─────────────────────────────────────────────────────────────────
function ClubPanel({ club, onUpdate }) {
  const [invite, setInvite] = useState(null) // { position, member }
  const [copiedClub, setCopiedClub] = useState(false)

  const topRow    = POSITIONS.filter(p => p.row === 0)
  const bottomRow = POSITIONS.filter(p => p.row === 1)

  function handleSlotPress(position) {
    setInvite({ position, member: club.members[position.key] })
  }

  function handleRemoveMember(posKey) {
    const updated = { ...club, members: { ...club.members, [posKey]: null } }
    saveClub(updated)
    onUpdate(updated)
    setInvite(null)
  }

  function copyClubLink() {
    navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
    setCopiedClub(true)
    setTimeout(() => setCopiedClub(false), 2500)
  }

  const memberCount = Object.values(club.members).filter(Boolean).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', overflow: 'auto' }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(27,58,107,0.35) 0%, transparent 60%)',
      }} />

      <AnimatePresence>
        {invite && (
          <InviteModal
            club={club}
            position={invite.position}
            member={invite.member}
            onClose={() => setInvite(null)}
            onRemove={() => handleRemoveMember(invite.position.key)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ padding: '28px 22px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <DiamondBadge abbr={club.abbr} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: '#5BB8F5', fontWeight: 700, marginBottom: 4 }}>
              {club.country.flag} {club.country.name}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
              textTransform: 'uppercase', color: 'var(--text-primary)',
              letterSpacing: 0.5, lineHeight: 1.1, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{club.name}</h1>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>
              {memberCount} / 5 zawodników
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 24,
        }}>
          {[
            { label: 'Skrót', val: club.abbr },
            { label: 'Zawodnicy', val: `${memberCount}/5` },
            { label: 'Status', val: memberCount === 5 ? 'Pełny' : 'Rekrutacja' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1, padding: '10px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, textAlign: 'center',
            }}>
              <p style={{ fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>{s.label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Basketball court - formation */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 16px 24px',
        gap: 8,
      }}>
        {/* Court background */}
        <div style={{
          position: 'absolute', inset: '0 0 80px 0',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
        }}>
          {/* Halfcourt circle */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: 120, height: 120,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.05)',
            transform: 'translate(-50%, -50%)',
          }} />
        </div>

        <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.20)', marginBottom: 4, zIndex: 1 }}>
          Skład
        </p>

        {/* Top row — PG, SG */}
        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', zIndex: 1 }}>
          {topRow.map(pos => (
            <PlayerSlot key={pos.key} position={pos} member={club.members[pos.key]}
              isCenter={false} onPress={() => handleSlotPress(pos)} />
          ))}
        </div>

        {/* Bottom row — SF, C, PF */}
        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'flex-end', zIndex: 1, marginTop: 12 }}>
          {bottomRow.map(pos => (
            <PlayerSlot key={pos.key} position={pos} member={club.members[pos.key]}
              isCenter={pos.isCenter} onPress={() => handleSlotPress(pos)} />
          ))}
        </div>
      </div>

      {/* Bottom share bar */}
      <div style={{
        padding: '16px 22px 100px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 10,
        position: 'relative', zIndex: 1,
        background: 'rgba(4,8,14,0.70)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={copyClubLink} style={{
          flex: 1, padding: '12px',
          background: copiedClub ? 'rgba(0,230,118,0.10)' : 'rgba(91,184,245,0.10)',
          border: copiedClub ? '1px solid rgba(0,230,118,0.30)' : '1px solid rgba(91,184,245,0.25)',
          borderRadius: 12,
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
          letterSpacing: 1, textTransform: 'uppercase',
          color: copiedClub ? '#00E676' : '#5BB8F5',
          cursor: 'pointer',
        }}>
          {copiedClub ? '✓ Skopiowano' : '🔗 Udostępnij klub'}
        </motion.button>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function ClubPage() {
  const { profile } = useAuth()
  const [club, setClub] = useState(() => loadClub())

  const ownerName    = profile?.name || 'Ty'
  const ownerInitial = ownerName.trim()[0]?.toUpperCase() || 'T'

  function handleCreated(newClub) {
    setClub(newClub)
  }

  function handleUpdate(updatedClub) {
    setClub(updatedClub)
  }

  return (
    <div className="page-content" style={{ padding: 0 }}>
      <AnimatePresence mode="wait">
        {!club ? (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%' }}
          >
            <CreateClub onCreated={handleCreated} ownerName={ownerName} ownerInitial={ownerInitial} />
          </motion.div>
        ) : (
          <motion.div key="panel"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <ClubPanel club={club} onUpdate={handleUpdate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
