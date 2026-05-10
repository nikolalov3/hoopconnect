// HoopConnect — Coach Panel design tokens
// Light, professional, brand-aligned (baby blue accent like the player app),
// but distinct vibe: cream/off-white surfaces, deep navy as authority accent.

export const theme = {
  // surfaces
  bg:        '#F6F8FB',  // page background — soft off-white-blue
  surface:   '#FFFFFF',  // card / panel background
  elevated:  '#FFFFFF',  // modal / dropdown
  sidebar:   '#FFFFFF',  // sidebar background

  // text
  text:      '#1A2233',  // primary
  textSoft:  '#4D5C73',  // secondary
  textMuted: '#8A9AB0',  // tertiary / hints

  // borders
  border:        '#E6ECF3',
  borderStrong:  '#D4DDE8',
  borderHover:   '#5591CD',

  // brand
  accent:        '#5591CD',  // baby blue (matches player app)
  accentSoft:    '#E8F1FA',  // tint
  accentStrong:  '#3D78B5',

  // authority accent (for coach panel, makes it feel "professional")
  navy:        '#1E3A5F',
  navySoft:    '#E2E8F1',

  // semantic
  success:    '#3FA86A',
  successSoft:'#E2F4EB',
  warning:    '#E5A93C',
  warningSoft:'#FCF2DE',
  danger:     '#D85546',
  dangerSoft: '#FCE5E2',

  // shadows
  shadowSm:  '0 1px 2px rgba(20, 35, 60, 0.06)',
  shadowMd:  '0 4px 12px rgba(20, 35, 60, 0.08)',
  shadowLg:  '0 12px 32px rgba(20, 35, 60, 0.12)',

  // radii
  rSm: 8,
  r:   12,
  rLg: 18,
  rXl: 24,

  // typography
  fontHeading: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  fontBody:    '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
}
