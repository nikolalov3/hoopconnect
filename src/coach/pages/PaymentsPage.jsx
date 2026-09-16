import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'

// Waluta PLN na sztywno (decyzja: bez wyboru waluty na start).
function zl(n) {
  return `${Number(n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
}
function todayISO() { return new Date().toISOString().slice(0, 10) }
function currentPeriod() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function periodLabel(period) {
  if (!period) return ''
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('pl-PL') : '—' }

export default function PaymentsPage() {
  const { currentTeam } = useCoachAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [feeAmount, setFeeAmount] = useState('')
  const [savingFee, setSavingFee] = useState(false)
  const [feeSaved, setFeeSaved] = useState(false)
  const [payments, setPayments] = useState([])
  const [subjects, setSubjects] = useState([])   // { kind:'member'|'manual', id, name }
  const [period, setPeriod] = useState(currentPeriod())
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => { if (currentTeam) load() }, [currentTeam?.id])

  async function load() {
    setLoading(true)
    setLoadError(null)
    const [feeRes, payRes, rosterRes, manualRes] = await Promise.all([
      supabase.from('team_fee_settings').select('*').eq('team_id', currentTeam.id).maybeSingle(),
      supabase.from('team_payments').select('*').eq('team_id', currentTeam.id).order('created_at', { ascending: false }),
      supabase.rpc('get_team_roster', { p_team_id: currentTeam.id }),
      supabase.from('team_manual_players').select('*').eq('team_id', currentTeam.id),
    ])
    if (payRes.error) setLoadError(payRes.error.message)
    setFeeAmount(feeRes.data?.amount != null ? String(feeRes.data.amount) : '')
    setPayments(payRes.data || [])
    const subs = []
    for (const m of (rosterRes.data || [])) {
      subs.push({ kind: 'member', id: m.player_id, name: [m.display_first_name, m.display_last_name].filter(Boolean).join(' ') || m.player_email?.split('@')[0] || 'Zawodnik' })
    }
    for (const p of (manualRes.data || [])) {
      subs.push({ kind: 'manual', id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Zawodnik' })
    }
    setSubjects(subs)
    setLoading(false)
  }

  const nameFor = (p) => {
    if (p.member_id) return subjects.find(s => s.kind === 'member' && s.id === p.member_id)?.name || 'Zawodnik'
    if (p.manual_id) return subjects.find(s => s.kind === 'manual' && s.id === p.manual_id)?.name || 'Zawodnik'
    return 'Cała drużyna'
  }

  const today = todayISO()
  const collected = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const overdue   = payments.filter(p => p.status === 'pending' && p.due_date && p.due_date < today).reduce((s, p) => s + Number(p.amount), 0)
  const pending   = payments.filter(p => p.status === 'pending' && (!p.due_date || p.due_date >= today)).reduce((s, p) => s + Number(p.amount), 0)

  async function saveFee() {
    setSavingFee(true)
    setFeeSaved(false)
    const amt = feeAmount.trim() ? Number(feeAmount) : 0
    const { error } = await supabase.from('team_fee_settings').upsert({
      team_id: currentTeam.id, amount: amt, updated_at: new Date().toISOString(),
    })
    setSavingFee(false)
    if (error) { setLoadError(error.message); return }
    setFeeSaved(true)
    setTimeout(() => setFeeSaved(false), 1500)
  }

  async function generateSkladka() {
    setLoadError(null)
    const amt = feeAmount.trim() ? Number(feeAmount) : 0
    if (!amt || amt <= 0) { setLoadError('Najpierw ustaw kwotę składki.'); return }
    if (subjects.length === 0) { setLoadError('Brak zawodników w składzie.'); return }
    setGenerating(true)
    // Idempotentnie: pomiń zawodników, którzy już mają składkę na ten okres.
    const existing = new Set(
      payments.filter(p => p.category === 'skladka' && p.period === period)
        .map(p => p.member_id ? `m:${p.member_id}` : `g:${p.manual_id}`)
    )
    const due = `${period}-10`
    const rows = subjects
      .filter(s => !existing.has(s.kind === 'member' ? `m:${s.id}` : `g:${s.id}`))
      .map(s => ({
        team_id: currentTeam.id,
        member_id: s.kind === 'member' ? s.id : null,
        manual_id: s.kind === 'manual' ? s.id : null,
        title: `Składka ${period}`,
        category: 'skladka',
        amount: amt,
        period,
        status: 'pending',
        due_date: due,
      }))
    if (rows.length === 0) { setGenerating(false); setLoadError(`Składka za ${periodLabel(period)} jest już wystawiona.`); return }
    const { error } = await supabase.from('team_payments').insert(rows)
    setGenerating(false)
    if (error) { setLoadError(error.message); return }
    load()
  }

  async function togglePaid(p) {
    const paid = p.status !== 'paid'
    await supabase.from('team_payments').update({
      status: paid ? 'paid' : 'pending', paid_at: paid ? new Date().toISOString() : null,
    }).eq('id', p.id)
    load()
  }

  async function deletePayment(id) {
    if (!window.confirm('Usunąć tę płatność?')) return
    await supabase.from('team_payments').delete().eq('id', id)
    load()
  }

  const filtered = payments.filter(p => statusFilter === 'all' || p.status === statusFilter)

  if (!currentTeam) return null

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Finanse · {currentTeam.name}</h1>
          <p className="coach-subtitle">Składki i inne opłaty drużyny. Kwoty w zł.</p>
        </div>
        <button className="coach-btn-primary" onClick={() => setShowAdd(true)}>+ Dodaj płatność</button>
      </header>

      {loadError && (
        <div className="coach-card" style={{ marginBottom: 14, background: '#FCE5E2', borderColor: '#F4B5AB', color: '#A1372A', fontSize: 13 }}>
          {loadError}
        </div>
      )}

      {/* Statystyki finansowe */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        <StatTile label="Zebrane" value={zl(collected)} color="#3FA86A" bg="#E2F4EB" />
        <StatTile label="Oczekujące" value={zl(pending)} color="#B0791C" bg="#FCF2DE" />
        <StatTile label="Zaległe" value={zl(overdue)} color="#C0392B" bg="#FCE5E2" />
      </div>

      {/* Składka */}
      <div className="coach-card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', marginBottom: 12 }}>
          Składka miesięczna
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 160 }}>
            <label className="coach-label">Kwota składki (zł)</label>
            <input className="coach-input" type="number" min="0" step="0.01" value={feeAmount}
              onChange={e => setFeeAmount(e.target.value)} placeholder="np. 120" />
          </div>
          <button className="coach-btn-secondary" onClick={saveFee} disabled={savingFee}>
            {savingFee ? 'Zapisywanie...' : feeSaved ? '✓ Zapisano' : 'Zapisz kwotę'}
          </button>
          <div style={{ flex: 1 }} />
          <div style={{ minWidth: 150 }}>
            <label className="coach-label">Miesiąc</label>
            <input className="coach-input" type="month" value={period} onChange={e => setPeriod(e.target.value)} />
          </div>
          <button className="coach-btn-primary" onClick={generateSkladka} disabled={generating}>
            {generating ? 'Wystawianie...' : `Wystaw składkę`}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#8A9AB0', marginTop: 10 }}>
          Wystawia składkę dla całego składu ({subjects.length}) za {periodLabel(period)}. Ponowne kliknięcie nie zdubluje.
        </div>
      </div>

      {/* Lista płatności */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[['all', 'Wszystkie'], ['pending', 'Do zapłaty'], ['paid', 'Zapłacone']].map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={statusFilter === v ? 'coach-btn-secondary' : 'coach-btn-ghost'}
            style={{ fontSize: 13, padding: '7px 12px' }}>{l}</button>
        ))}
      </div>

      {loading ? (
        <div className="coach-card"><div className="coach-placeholder" style={{ minHeight: 160 }}><div className="spinner" /></div></div>
      ) : filtered.length === 0 ? (
        <div className="coach-card">
          <div className="coach-placeholder" style={{ minHeight: 180 }}>
            <div className="coach-placeholder-title">Brak płatności</div>
            <div style={{ marginBottom: 18 }}>Ustaw składkę i wystaw ją za miesiąc, albo dodaj pojedynczą opłatę.</div>
            <button className="coach-btn-primary" onClick={() => setShowAdd(true)}>Dodaj płatność</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => {
            const isOverdue = p.status === 'pending' && p.due_date && p.due_date < today
            return (
              <div key={p.id} className="coach-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {nameFor(p)}
                  </div>
                  <div style={{ fontSize: 12, color: '#8A9AB0' }}>
                    {p.title}{p.due_date ? ` · termin ${fmtDate(p.due_date)}` : ''}
                  </div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2233', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{zl(p.amount)}</div>
                <span style={{
                  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '4px 9px', borderRadius: 99, flexShrink: 0,
                  color: p.status === 'paid' ? '#1E6B3D' : isOverdue ? '#C0392B' : '#B0791C',
                  background: p.status === 'paid' ? '#E2F4EB' : isOverdue ? '#FCE5E2' : '#FCF2DE',
                }}>
                  {p.status === 'paid' ? 'Zapłacone' : isOverdue ? 'Zaległe' : 'Do zapłaty'}
                </span>
                <button className="coach-btn-secondary" style={{ fontSize: 12, padding: '6px 10px', flexShrink: 0 }} onClick={() => togglePaid(p)}>
                  {p.status === 'paid' ? 'Cofnij' : 'Zapłacone'}
                </button>
                <button className="coach-btn-ghost" style={{ fontSize: 12, padding: '6px 10px', color: '#D85546', flexShrink: 0 }} onClick={() => deletePayment(p.id)}>
                  Usuń
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <AddPaymentModal
          team={currentTeam}
          subjects={subjects}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}
    </div>
  )
}

function StatTile({ label, value, color, bg }) {
  return (
    <div className="coach-card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 0 3px ${bg}` }} />
        <span style={{ fontSize: 22, fontWeight: 800, color: '#1A2233', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
    </div>
  )
}

/** Dodanie pojedynczej płatności (składka lub inna) dla zawodnika lub całej drużyny. */
function AddPaymentModal({ team, subjects, onClose, onAdded }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [subjectKey, setSubjectKey] = useState('team')   // 'team' | 'member:<id>' | 'manual:<id>'
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!title.trim()) { setError('Podaj tytuł płatności.'); return }
    const amt = amount.trim() ? Number(amount) : NaN
    if (!amt || amt <= 0) { setError('Podaj kwotę większą od zera.'); return }
    setSubmitting(true)
    let member_id = null, manual_id = null
    if (subjectKey.startsWith('member:')) member_id = subjectKey.slice(7)
    else if (subjectKey.startsWith('manual:')) manual_id = subjectKey.slice(7)
    const { error: insErr } = await supabase.from('team_payments').insert({
      team_id: team.id, member_id, manual_id,
      title: title.trim(), category: 'inne', amount: amt,
      status: 'pending', due_date: dueDate || null,
    })
    setSubmitting(false)
    if (insErr) { setError(insErr.message); return }
    onAdded()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20, 35, 60, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 200 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#FFFFFF', width: '100%', maxWidth: 460, borderRadius: 18, padding: 28 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Dodaj płatność</h2>
        <p className="coach-subtitle" style={{ marginBottom: 20 }}>Jednorazowa opłata (np. obóz, koszulki) dla zawodnika lub całej drużyny.</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Tytuł *</label>
            <input className="coach-input" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="np. Obóz letni" autoFocus required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="coach-label">Kwota (zł) *</label>
              <input className="coach-input" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="np. 300" required />
            </div>
            <div>
              <label className="coach-label">Termin (opcjonalnie)</label>
              <input className="coach-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="coach-label">Dla kogo</label>
            <select className="coach-input" value={subjectKey} onChange={e => setSubjectKey(e.target.value)}>
              <option value="team">Cała drużyna</option>
              {subjects.map(s => (
                <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>{s.name}</option>
              ))}
            </select>
          </div>

          {error && (
            <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={onClose} className="coach-btn-secondary" style={{ flex: 1 }}>Anuluj</button>
            <button type="submit" className="coach-btn-primary" disabled={submitting} style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Dodawanie...' : 'Dodaj płatność'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
