import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAdminAuth } from '../context/AdminAuthContext'
import { generateContractPdf } from '../lib/generatePdf'

const PL_MONTHS = ['stycznia','lutego','marca','kwietnia','maja','czerwca',
                   'lipca','sierpnia','września','października','listopada','grudnia']
const plDate = (isoDate) => {
  const d = new Date(isoDate)
  return `${d.getDate()} ${PL_MONTHS[d.getMonth()]} ${d.getFullYear()} r.`
}
const slugify = (text) => (text || '').trim().toLowerCase()
  .replace(/[^a-z0-9ąćęłńóśźż\s-]+/g, '').replace(/[\s_-]+/g, '-') || 'klub'

export default function GeneratorPage() {
  const { user } = useAdminAuth()

  const todayIso = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    klub_nazwa: '', klub_adres: '', klub_nip: '', klub_reprezentant: '',
    klub_email: '', data_zawarcia: todayIso, miasto: 'Kłodawa', send_to: '',
  })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const [working, setWorking] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)   // { contractId, pdfUrl, filename }
  const [sendStatus, setSendStatus] = useState(null)  // 'sending'|'sent'|'error'

  const generate = async (e) => {
    e.preventDefault()
    setError(null); setResult(null); setSendStatus(null)
    if (!form.klub_nazwa.trim()) { setError('Nazwa Klubu jest wymagana.'); return }
    setWorking(true)
    try {
      const data = {
        ...form,
        data_zawarcia: plDate(form.data_zawarcia),
      }
      const { blob, base64 } = await generateContractPdf(data)
      const filename = `umowa_${slugify(form.klub_nazwa)}_${form.data_zawarcia}.pdf`

      // Upload to Supabase Storage (path: <user_id>/<filename>)
      const storagePath = `${user.id}/${Date.now()}_${filename}`
      const { error: upErr } = await supabase.storage
        .from('admin_contracts')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false })
      if (upErr) throw new Error('Upload: ' + upErr.message)

      // Insert DB row
      const { data: row, error: dbErr } = await supabase
        .from('admin_contracts')
        .insert({
          klub_nazwa:        form.klub_nazwa.trim(),
          klub_adres:        form.klub_adres.trim() || null,
          klub_nip:          form.klub_nip.trim() || null,
          klub_reprezentant: form.klub_reprezentant.trim() || null,
          klub_email:        form.klub_email.trim() || null,
          data_zawarcia:     data.data_zawarcia,
          miasto:            form.miasto.trim() || 'Kłodawa',
          pdf_path:          storagePath,
          created_by:        user.id,
        })
        .select()
        .single()
      if (dbErr) throw new Error('DB: ' + dbErr.message)

      // Browser-side blob URL for instant download
      const pdfUrl = URL.createObjectURL(blob)

      setResult({ contractId: row.id, pdfUrl, filename, base64 })
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setWorking(false)
    }
  }

  const sendEmail = async () => {
    if (!result) return
    const to = form.send_to.trim() || form.klub_email.trim()
    if (!to) { setError('Brak adresu odbiorcy.'); return }
    setSendStatus('sending'); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Brak sesji — zaloguj się ponownie.')

      const subject = `Umowa o świadczenie usług — HoopConnect (${form.klub_nazwa.trim()})`
      const body =
        `Cześć,\n\n` +
        `W załączeniu umowa o świadczenie usług platformy HoopConnect dla ${form.klub_nazwa.trim()}.\n\n` +
        `Daj znać jeśli coś wymaga doprecyzowania — zawsze możemy dopisać/zmienić.\n\n` +
        `Pozdrawiam,\n` +
        `Mikołaj Kretowicz\n` +
        `Not A Slop · HoopConnect\n` +
        `kontakt@hoopconnect.pl`

      const res = await fetch('/api/admin/send-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to, subject, body,
          pdf_base64:   result.base64,
          pdf_filename: result.filename,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      // Update DB row z sent_at + sent_to
      await supabase.from('admin_contracts')
        .update({ sent_at: new Date().toISOString(), sent_to: to })
        .eq('id', result.contractId)

      setSendStatus('sent')
    } catch (err) {
      setSendStatus('error')
      setError(err.message || String(err))
    }
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="admin-h1">Generator umów</h1>
        <p className="admin-subtitle">Wpisz dane Klubu, wygeneruj PDF, wyślij mailem.</p>
      </header>

      <div className="admin-card" style={{ marginBottom: 16 }}>
        <form onSubmit={generate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2 className="admin-h2" style={{ marginBottom: 4 }}>Dane Klubu</h2>
          <div>
            <label className="admin-label">Nazwa Klubu *</label>
            <input className="admin-input" value={form.klub_nazwa} onChange={e => set('klub_nazwa', e.target.value)} placeholder="np. UKS Polonia Warszawa" required/>
          </div>
          <div>
            <label className="admin-label">Adres</label>
            <input className="admin-input" value={form.klub_adres} onChange={e => set('klub_adres', e.target.value)} placeholder="np. ul. Sportowa 5, 00-001 Warszawa"/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="admin-label">NIP / REGON</label>
              <input className="admin-input" value={form.klub_nip} onChange={e => set('klub_nip', e.target.value)}/>
            </div>
            <div>
              <label className="admin-label">E-mail kontaktowy</label>
              <input className="admin-input" type="email" value={form.klub_email} onChange={e => set('klub_email', e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="admin-label">Reprezentowany przez</label>
            <input className="admin-input" value={form.klub_reprezentant} onChange={e => set('klub_reprezentant', e.target.value)} placeholder="np. Jan Kowalski, Prezes Zarządu"/>
          </div>

          <h2 className="admin-h2" style={{ marginTop: 12, marginBottom: 4 }}>Szczegóły umowy</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="admin-label">Data zawarcia</label>
              <input className="admin-input" type="date" value={form.data_zawarcia} onChange={e => set('data_zawarcia', e.target.value)}/>
            </div>
            <div>
              <label className="admin-label">Miasto</label>
              <input className="admin-input" value={form.miasto} onChange={e => set('miasto', e.target.value)}/>
            </div>
          </div>

          <h2 className="admin-h2" style={{ marginTop: 12, marginBottom: 4 }}>Wysyłka (opcjonalna)</h2>
          <div>
            <label className="admin-label">Email do wysłania umowy</label>
            <input
              className="admin-input"
              type="email"
              value={form.send_to}
              onChange={e => set('send_to', e.target.value)}
              placeholder="Domyślnie ten sam co kontaktowy klubu."
            />
          </div>

          {error && (
            <div style={{
              background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A',
              padding: '10px 12px', borderRadius: 10, fontSize: 13,
            }}>{error}</div>
          )}

          <button type="submit" className="admin-btn-primary" disabled={working}>
            {working ? 'Generowanie...' : '🏀 Wygeneruj PDF'}
          </button>
        </form>
      </div>

      {result && (
        <div className="admin-card">
          <h2 className="admin-h2" style={{ marginBottom: 12 }}>Gotowe</h2>
          <p style={{ fontSize: 13, color: '#4D5C73', marginBottom: 16 }}>
            <strong>{result.filename}</strong> — zapisano w historii.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer"
              className="admin-btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              👁️ Podgląd
            </a>
            <a href={result.pdfUrl} download={result.filename}
              className="admin-btn-secondary" style={{ textAlign: 'center', textDecoration: 'none' }}>
              ⬇️ Pobierz
            </a>
          </div>
          <div style={{ marginTop: 12 }}>
            {sendStatus === 'sent' ? (
              <div style={{
                background: '#E2F4EB', border: '1px solid #9CD9B7', color: '#1E6B3D',
                padding: '10px 12px', borderRadius: 10, fontSize: 13, textAlign: 'center', fontWeight: 600,
              }}>
                ✓ Wysłano do {form.send_to.trim() || form.klub_email.trim()}
              </div>
            ) : (
              <button onClick={sendEmail} disabled={sendStatus === 'sending' || (!form.send_to.trim() && !form.klub_email.trim())}
                className="admin-btn-primary" style={{ width: '100%' }}>
                {sendStatus === 'sending' ? 'Wysyłanie...' : '📧 Wyślij mailem'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
