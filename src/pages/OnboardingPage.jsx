import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCountryOptions } from '../lib/countries'
import { validateName } from '../lib/nameFilter'

const DAYS_COLORS = ['#00E676', '#7ECBFF', '#5BB8F5', '#FF3D3D']

const STEP_COUNT = 2
const onbLabel = { fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 8 }
const BLUE = '#5BB8F5'

function WelcomeScreen({ userName, onComplete }) {
  const { t } = useTranslation('onboarding')
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,8,14,0.98)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        // Scroll root instead of hard vertical centering, so on short screens the
        // final CTA can't get stranded off-screen (inner wrapper uses margin:auto).
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        padding: '0 26px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Glow top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 260,
        background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${BLUE}28 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Glow bottom */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 180,
        background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${BLUE}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Badge — jak ikona osiągnięcia */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 20 }}
          style={{
            width: 110, height: 110, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${BLUE}30, ${BLUE}08)`,
            border: `1.5px solid ${BLUE}55`,
            boxShadow: `0 0 48px ${BLUE}39, 0 0 80px ${BLUE}15, inset 0 1px 0 ${BLUE}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28,
            fontSize: 54,
          }}
        >
          🏀
        </motion.div>

        {/* Label nad tytułem */}
        <motion.p
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
            color: BLUE, fontWeight: 700, marginBottom: 10,
          }}
        >
          {t('welcome.betaLabel')}
        </motion.p>

        {/* Główny nagłówek */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 44, color: 'var(--text-primary)',
            textTransform: 'uppercase', letterSpacing: 1,
            lineHeight: 1.0, textAlign: 'center', marginBottom: 6,
            textShadow: `0 0 40px ${BLUE}2B`,
          }}
        >
          {userName ? t('welcome.titleNamed', { name: userName }) : t('welcome.titleAnon')}
        </motion.h1>

        {/* Karta z tekstem — jak karta osiągnięcia */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.42 }}
          style={{
            width: '100%', marginTop: 24, marginBottom: 32,
            background: 'rgba(10,16,22,0.75)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: `1px solid ${BLUE}25`,
            borderTop: `1px solid ${BLUE}45`,
            borderRadius: 20,
            padding: '20px 22px',
            boxShadow: `0 8px 32px rgba(0,0,0,0.50), 0 0 24px ${BLUE}0E`,
          }}
        >
          <p style={{
            fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
            color: BLUE, fontWeight: 700, marginBottom: 10,
          }}>
            {t('welcome.betaUnlocked')}
          </p>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 14,
            lineHeight: 1.65, fontWeight: 400,
          }}>
            {t('welcome.betaTextPrefix')}<span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t('welcome.betaTextBold')}</span>{t('welcome.betaTextSuffix')}
          </p>
        </motion.div>

        {/* Discord card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.50 }}
          style={{
            width: '100%', marginBottom: 16,
            background: 'rgba(88,101,242,0.12)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(88,101,242,0.30)',
            borderTop: '1px solid rgba(88,101,242,0.50)',
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: '0 8px 28px rgba(0,0,0,0.40), 0 0 20px rgba(88,101,242,0.09)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="rgba(88,101,242,0.95)">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            <p style={{
              fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
              color: 'rgba(88,101,242,0.90)', fontWeight: 700,
            }}>
              {t('welcome.discordLabel')}
            </p>
          </div>
          <p style={{
            color: 'var(--text-secondary)', fontSize: 13,
            lineHeight: 1.60, fontWeight: 400, marginBottom: 14,
          }}>
            {t('welcome.discordText')}
          </p>
          <a
            href="https://discord.gg/7TwhZAvEzb"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '12px',
              background: 'rgba(88,101,242,0.18)',
              border: '1px solid rgba(88,101,242,0.40)',
              borderRadius: 12,
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase',
              color: 'rgba(160,170,255,0.95)',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(160,170,255,0.95)">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            {t('welcome.discordButton')}
          </a>
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          whileTap={{ scale: 0.97 }}
          onClick={onComplete}
          className="btn-primary"
          style={{
            width: '100%', fontSize: 16, padding: '18px',
            letterSpacing: 2,
            background: `linear-gradient(135deg, ${BLUE}CC, ${BLUE}99)`,
            boxShadow: `0 4px 24px ${BLUE}40, 0 0 40px ${BLUE}1D`,
            border: `1px solid ${BLUE}60`,
          }}
        >
          {t('welcome.cta')}
        </motion.button>

      </div>
    </motion.div>
  )
}

export default function OnboardingPage() {
  const { t, i18n } = useTranslation('onboarding')
  const { user, setProfileData } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const currentYear = new Date().getFullYear()
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const age = (birthDay && birthMonth && birthYear)
    ? (() => {
        const today = new Date()
        const birth = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay))
        let a = today.getFullYear() - birth.getFullYear()
        if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) a--
        return a
      })()
    : null
  const [trainingDays, setTrainingDays] = useState(4)
  const [city,    setCity]    = useState('')
  const [country, setCountry] = useState('PL')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showWelcome, setShowWelcome] = useState(false)

  async function handleFinish() {
    if (!name.trim()) { setError(t('errors.nameRequired')); return }
    if (!validateName(name).ok) { setError(t('errors.nameNotAllowed')); return }
    if (!birthDay || !birthMonth || !birthYear) { setError(t('errors.birthRequired')); return }
    if (!user?.id) { setError(t('errors.noSession')); return }
    setSaving(true)
    setError('')

    const profileData = {
      name: name.trim(),
      username: user.email ?? null,
      age,
      training_days: trainingDays,
      onboarding_done: true,
      schedule_type: trainingDays <= 3 ? 'light' : trainingDays <= 4 ? 'balanced' : 'intense',
      // Rejestracja = zawsze dzień treningowy
      registration_date: new Date().toISOString().split('T')[0],
      ...(city.trim()    && { city:    city.trim()    }),
      ...(country.trim() && { country: country.trim() }),
    }

    try {
      // Próbuj UPDATE najpierw (działa zawsze jeśli wiersz istnieje)
      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id)
        .select('id')

      if (updateErr) throw updateErr

      // Jeśli UPDATE nie trafił w żaden wiersz — trigger nie stworzył profilu, rób INSERT
      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: user.id, username: user.email, ...profileData })
        if (insertErr) throw insertErr
      }

      setProfileData({ ...profileData })
      setSaving(false)
      setShowWelcome(true)
    } catch(e) {
      setError(t('errors.saveError', { message: e.message }))
      setSaving(false)
    }
  }

  const canNext = step === 0
    ? (name.trim().length >= 2 && !!birthDay && !!birthMonth && !!birthYear)
    : true
  const dayOptions = t('step2.days', { returnObjects: true }).map((opt, i) => ({
    value: i + 3, label: opt.label, sub: opt.sub, color: DAYS_COLORS[i],
  }))
  const months = t('step1.months', { returnObjects: true })
  const countries = useMemo(() => getCountryOptions(i18n.language), [i18n.language])

  return (
    <div style={{
      // Own scroll root: cap to viewport (height, not minHeight) + overflowY:auto so
      // when a step is taller than the screen (small phones, keyboard open) the
      // "Dalej"/finish button below scrolls into reach instead of being clipped.
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 0 40px',
      position: 'relative',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      <AnimatePresence>
        {showWelcome && (
          <WelcomeScreen
            userName={name.trim()}
            onComplete={() => {
              // Nowe konto → po WelcomeScreen odpal story onboarding nad menu (AppShell to podłapie)
              localStorage.setItem('hc_story_pending', '1')
              navigate('/', { replace: true })
            }}
          />
        )}
      </AnimatePresence>

      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.22) 0%, transparent 60%)',
      }} />

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '32px 0 0' }}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 28 : 8, height: 8,
            borderRadius: 4,
            background: i <= step ? 'var(--orange)' : 'rgba(255,255,255,0.12)',
            transition: 'all 0.3s ease',
            boxShadow: i === step ? '0 0 12px rgba(91,184,245,0.59)' : 'none',
          }} />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* PANEL 0 — O Tobie: imię + data urodzenia + kraj + miasto */}
        {step === 0 && (
          <motion.div key="p0"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            style={{ flex: 1, padding: '30px 26px 0', display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <div>
              <p className="section-label" style={{ marginBottom: 8 }}>{t('stepOf', { n: 1, total: STEP_COUNT })}</p>
              <h1 className="display-title" style={{ fontSize: 40, marginBottom: 6 }}>O Tobie</h1>
              <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Kilka podstawowych informacji o Tobie.</p>
            </div>

            {/* Imię */}
            <div>
              <p style={onbLabel}>Imię</p>
              <input className="input-field" type="text" placeholder={t('step0.placeholder')}
                value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={30}
                style={{ fontSize: 18, padding: '15px 16px', letterSpacing: 0.5 }}/>
            </div>

            {/* Data urodzenia */}
            <div>
              <p style={onbLabel}>Data urodzenia</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.4fr', gap: 10, alignItems: 'end' }}>
                {[
                  { label: t('step1.day'),   value: birthDay,   set: setBirthDay,   options: Array.from({ length: 31 }, (_, i) => ({ val: i+1, label: String(i+1) })) },
                  { label: t('step1.month'), value: birthMonth, set: setBirthMonth, options: months.map((m,i) => ({ val: i+1, label: m })) },
                  { label: t('step1.year'),  value: birthYear,  set: setBirthYear,  options: Array.from({ length: 58 }, (_, i) => ({ val: currentYear-10-i, label: String(currentYear-10-i) })) },
                ].map(({ label, value, set, options }) => (
                  <select key={label} value={value} onChange={e => set(e.target.value)} aria-label={label}
                    style={{
                      width: '100%', padding: '15px 6px',
                      background: 'rgba(6,14,30,0.52)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                      border: `1px solid ${value ? 'rgba(91,184,245,0.40)' : 'rgba(120,190,255,0.09)'}`,
                      borderTop: `1px solid ${value ? 'rgba(91,184,245,0.55)' : 'rgba(160,210,255,0.16)'}`,
                      borderRadius: 'var(--radius-sm)', color: value ? 'var(--text-primary)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, textAlign: 'center',
                      cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
                    }}>
                    <option value="">{label}</option>
                    {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                ))}
              </div>
              {age !== null && age <= 18 && (() => {
                const phaseKey = age <= 14 ? 'foundations' : age <= 16 ? 'development' : 'intensification'
                return (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    style={{ marginTop: 12, padding: '14px 18px', background: 'rgba(6,14,30,0.52)',
                      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                      border: '1px solid rgba(120,190,255,0.09)', borderTop: '1px solid rgba(160,210,255,0.16)',
                      borderRadius: 'var(--radius)' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--orange)', letterSpacing: 1, marginBottom: 4 }}>
                      {t('step1.ageLabel', { age })} · {t(`step1.phases.${phaseKey}`)}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, lineHeight: 1.5 }}>{t(`step1.descs.${phaseKey}`)}</p>
                  </motion.div>
                )
              })()}
            </div>

            {/* Kraj */}
            <div>
              <p style={onbLabel}>{t('step3.country')}</p>
              <select value={country} onChange={e => setCountry(e.target.value)}
                style={{
                  width: '100%', padding: '15px 14px',
                  background: 'rgba(6,14,30,0.52)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid rgba(91,184,245,0.40)', borderTop: '1px solid rgba(91,184,245,0.55)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                  cursor: 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none', boxSizing: 'border-box',
                }}>
                {countries.map(c => (
                  c.separator ? <option key="sep" disabled>{c.name}</option> : <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                ))}
              </select>
            </div>

            {/* Miasto */}
            <div>
              <p style={onbLabel}>{t('step3.city')}</p>
              <input className="input-field" type="text" placeholder={t('step3.cityPlaceholder')}
                value={city} onChange={e => setCity(e.target.value)} maxLength={60}
                style={{ fontSize: 17, padding: '15px 14px', letterSpacing: 0.4 }}/>
            </div>

            {error && <p style={{ color: 'var(--red-shot)', fontSize: 13, textAlign: 'center' }}>{error}</p>}
          </motion.div>
        )}

        {/* PANEL 1 — Trening: dni */}
        {step === 1 && (
          <motion.div key="p1"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            style={{ flex: 1, padding: '40px 26px 0', display: 'flex', flexDirection: 'column' }}
          >
            <p className="section-label" style={{ marginBottom: 8 }}>{t('stepOf', { n: 2, total: STEP_COUNT })}</p>
            <h1 className="display-title" style={{ fontSize: 42, marginBottom: 8, whiteSpace: 'pre-line' }}>
              {t('step2.title')}
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>
              {t('step2.sub')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dayOptions.map(opt => (
                <motion.button key={opt.value} whileTap={{ scale: 0.98 }}
                  onClick={() => setTrainingDays(opt.value)}
                  style={{
                    padding: '16px 20px',
                    background: trainingDays === opt.value
                      ? `rgba(${opt.value >= 6 ? '255,61,61' : opt.value >= 5 ? '255,85,0' : opt.value >= 4 ? '255,122,0' : '0,230,118'},0.12)`
                      : 'rgba(12,8,4,0.60)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: trainingDays === opt.value
                      ? `1px solid ${opt.color}55`
                      : '1px solid rgba(255,255,255,0.09)',
                    borderTop: trainingDays === opt.value
                      ? `1px solid ${opt.color}80`
                      : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: trainingDays === opt.value
                      ? `0 8px 24px rgba(0,0,0,0.40), 0 0 20px ${opt.color}20`
                      : '0 4px 16px rgba(0,0,0,0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: trainingDays === opt.value ? opt.color + '25' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${trainingDays === opt.value ? opt.color + '60' : 'rgba(255,255,255,0.10)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
                    color: trainingDays === opt.value ? opt.color : 'var(--text-dim)',
                  }}>{opt.value}</div>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                      color: trainingDays === opt.value ? opt.color : 'var(--text-primary)',
                      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
                    }}>{opt.label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>{opt.sub}</p>
                  </div>
                  {trainingDays === opt.value && (
                    <div style={{ marginLeft: 'auto', color: opt.color }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {error && (
              <p style={{ color: 'var(--red-shot)', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Navigation buttons */}
      <div style={{ padding: '24px 26px 0', display: 'flex', gap: 12, marginTop: 'auto' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-ghost" style={{
            width: 52, height: 52, padding: 0, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>{t('back')}</button>
        )}

        {step < STEP_COUNT - 1 ? (
          <button
            onClick={() => canNext && setStep(s => s + 1)}
            className="btn-primary"
            style={{ opacity: canNext ? 1 : 0.4, flex: 1 }}
          >
            {t('next')}
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="btn-primary"
            disabled={saving}
            style={{ flex: 1, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? '...' : t('finishCta', { name: name.trim().toUpperCase() })}
          </button>
        )}
      </div>
    </div>
  )
}
