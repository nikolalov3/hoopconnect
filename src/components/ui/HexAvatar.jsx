/**
 * HexAvatar + HexFrameOnly
 * ─────────────────────────
 * Frame is a PNG overlay loaded from /frames/{variant}.png
 * Falls back to SVG frame if image fails to load.
 *
 * variant: 'default' | 'beta' | 'gold'
 *
 * PNG spec: 1024×1024 px, transparent background, hex frame centered.
 * Drop PNGs into:  public/frames/default.png  etc.
 */
import { useId } from 'react'

// ── Avatar hex coordinates (90×90 space) ─────────────────────────────────────
const AVATAR   = "45,6 82,32 82,58 45,84 8,58 8,32"
const AVATAR_S = "45,9 84,33 84,61 45,87 6,61 6,33"  // drop-shadow offset

// ── Glow colours per variant ─────────────────────────────────────────────────
const GLOWS = {
  default:     'rgba(91,184,245,0.55)',
  betatester:  'rgba(91,184,245,0.55)',
  beta:        'rgba(220,160,30,0.55)',
  gold:        'rgba(255,180,20,0.65)',
}

// ── Frame PNG paths per variant ──────────────────────────────────────────────
const FRAME_PATHS = {
  default:     '/ramka.png',
  betatester:  '/ramka.png',
  beta:        '/ramka.png',
  gold:        '/ramka.png',
}

// ── Shared frame SVG ─────────────────────────────────────────────────────────
// viewBox "-16 -16 122 122" so the PNG (which fills the whole 122×122 space)
// is placed at x=-16 y=-16 width=122 height=122 and perfectly covers the hex.
function FrameSVG({ id, variant, avatarContent, size, clip = false }) {
  const glow = GLOWS[variant] || GLOWS.default
  const src  = FRAME_PATHS[variant] || FRAME_PATHS.default

  return (
    <svg
      width={size}
      height={size}
      viewBox="-16 -16 122 122"
      style={{ flexShrink: 0, overflow: clip ? 'hidden' : 'visible' }}
    >
      <defs>
        {/* Avatar fill gradient */}
        <linearGradient id={`av${id}`} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#7BC8F8" />
          <stop offset="40%"  stopColor="#5BB8F5" />
          <stop offset="100%" stopColor="#1B3A6B" />
        </linearGradient>

        {/* Ambient glow blur */}
        <filter id={`gf${id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ── Ambient glow bloom (behind everything) ── */}
      <polygon
        points="45,-6 93,22 93,68 45,96 -3,68 -3,22"
        fill="none"
        stroke={glow}
        strokeWidth="18"
        filter={`url(#gf${id})`}
      >
        <animate attributeName="opacity"
          values="0.35;0.80;0.35"
          dur="2.8s"
          repeatCount="indefinite" />
      </polygon>

      {/* ── Avatar body ── */}
      {avatarContent}

      {/* ── PNG frame overlay ── */}
      {/* x=-16 y=-16 fills the full viewBox so the PNG aligns perfectly */}
      <image
        href={src}
        x="-16" y="-16"
        width="122" height="122"
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  )
}

// ── PUBLIC: frame-only overlay (absolutely positioned on top of existing hex) ─
export function HexFrameOnly({ size = 78, variant = 'default' }) {
  const raw = useId()
  const id  = raw.replace(/[^a-zA-Z0-9]/g, 'x')

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none', zIndex: 10,
    }}>
      <FrameSVG id={id} variant={variant} avatarContent={null} size={size} clip />
    </div>
  )
}

// ── PUBLIC: full avatar (avatar body + frame) ─────────────────────────────────
export default function HexAvatar({ name, size = 44, variant = 'default' }) {
  const raw = useId()
  const id  = raw.replace(/[^a-zA-Z0-9]/g, 'x')
  const initial = name ? name.trim()[0].toUpperCase() : '?'

  const avatar = (
    <>
      <polygon points={AVATAR_S} fill="rgba(0,0,0,0.30)" />
      <polygon points={AVATAR}   fill={`url(#av${id})`} />
      <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,0.28)" />
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.13)" />
      <polygon points="8,32 8,58 45,48 45,42"  fill="rgba(91,184,245,0.15)" />
      <polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,0,0,0.22)" />
      <polygon points={AVATAR}
        fill="none" stroke="rgba(255,255,255,0.40)"
        strokeWidth="1.5" strokeLinejoin="round" />
      <text x="45" y="49"
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="30" fontWeight="800"
        fontFamily="'Barlow Condensed', Barlow, sans-serif">
        {initial}
      </text>
    </>
  )

  return <FrameSVG id={id} variant={variant} avatarContent={avatar} size={size} />
}
