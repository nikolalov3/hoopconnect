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

  // Edytowalna treść maila — pre-fill po wygenerowaniu, możesz dopisać/zmienić
  // cokolwiek przed wysyłką.
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')

  // Buduje domyślny szablon na podstawie aktualnych danych klubu.
  const buildTemplate = (klubName) => {
    const subject = `Umowa o współpracy — HoopConnect dla ${klubName}`
    const body = (
      `Cześć,\n\n` +
      `W załączeniu umowa o świadczenie usług platformy HoopConnect dla ${klubName}.\n\n` +
      `HoopConnect to polska aplikacja do prowadzenia drużyny koszykarskiej — panel ` +
      `trenera do planowania treningów, frekwencji i komunikacji z drużyną, plus ` +
      `aplikacja zawodnika z indywidualnymi treningami, statystykami i osiągnięciami. ` +
      `Wszystko działa na telefonie i komputerze.\n\n` +
      `Co dalej, jeśli zdecydujecie się na współpracę:\n` +
      `  1. Trener zakłada konto na trener.hoopconnect.pl (zajmuje 2 minuty).\n` +
      `  2. Dodaje zawodników po adresach e-mail — każdy dostaje zaproszenie.\n` +
      `  3. Pierwszy miesiąc jest bezpłatny, bez zobowiązania — testujecie, ` +
      `decydujecie czy zostajecie.\n\n` +
      `W razie pytań co do umowy lub samej platformy — odpowiem na każde, ` +
      `chętnie też wskoczymy na krótką rozmowę.\n\n` +
      `Pozdrawiam,\n` +
      `Mikołaj Kretowicz\n` +
      `Not A Slop · HoopConnect\n` +
      `kontakt@hoopconnect.pl\n` +
      `trener.hoopconnect.pl`
    )
    return { subject, body }
  }

  const [step, setStep] = useState('')   // diagnostyka: który krok aktualnie się wykonuje

  const generate = async (e) => {
    e.preventDefault()
    setError(null); setResult(null); setSendStatus(null); setStep('')
    if (!form.klub_nazwa.trim()) { setError('Nazwa Klubu jest wymagana.'); return }
    setWorking(true)
    try {
      const data = {
        ...form,
        data_zawarcia: plDate(form.data_zawarcia),
      }

      setStep('Generowanie PDF…'); console.log('[generate] step: PDF gen')
      const { blob, base64 } = await generateContractPdf(data)
      const filename = `umowa_${slugify(form.klub_nazwa)}_${form.data_zawarcia}.pdf`
      console.log('[generate] PDF ready, size:', blob.size)

      setStep('Upload do Storage…'); console.log('[generate] step: storage upload')
      const storagePath = `${user.id}/${Date.now()}_${filename}`
      const { error: upErr } = await supabase.storage
        .from('admin_contracts')
        .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false })
      if (upErr) {
        console.error('[generate] upload error:', upErr)
        throw new Error('Upload do Storage: ' + (upErr.message || 'nieznany błąd'))
      }
      console.log('[generate] upload OK:', storagePath)

      setStep('Zapis do bazy…'); console.log('[generate] step: DB insert')
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
      if (dbErr) {
        console.error('[generate] DB error:', dbErr)
        throw new Error('Zapis do bazy: ' + (dbErr.message || 'nieznany błąd'))
      }
      console.log('[generate] DB row created:', row?.id)

      // Browser-side blob URL for instant download
      const pdfUrl = URL.createObjectURL(blob)

      // Pre-fill email template (możesz potem edytować w UI)
      const { subject, body } = buildTemplate(form.klub_nazwa.trim())
      setMailSubject(subject)
      setMailBody(body)

      setResult({ contractId: row.id, pdfUrl, filename, base64 })
      setStep('')
    } catch (err) {
      console.error('[generate] failed:', err)
      setError(err.message || String(err))
    } finally {
      setWorking(false)
    }
  }

  const sendEmail = async () => {
    if (!result) return
    const to = form.send_to.trim() || form.klub_email.trim()
    if (!to) { setError('Brak adresu odbiorcy.'); return }
    if (!mailSubject.trim() || !mailBody.trim()) {
      setError('Temat i treść maila nie mogą być puste.')
      return
    }
    setSendStatus('sending'); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Brak sesji — zaloguj się ponownie.')

      const res = await fetch('/api/admin/send-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to,
          subject:      mailSubject,
          body:         mailBody,
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
            {working ? (step || 'Generowanie...') : '🏀 Wygeneruj PDF'}
          </button>
        </form>
      </div>

      {result && (
        <>
          <div className="admin-card" style={{ marginBottom: 16 }}>
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
          </div>

          {sendStatus === 'sent' ? (
            <div className="admin-card" style={{
              background: '#E2F4EB', border: '1px solid #9CD9B7', color: '#1E6B3D',
              fontSize: 14, fontWeight: 600, textAlign: 'center', padding: 18,
            }}>
              ✓ Wysłano do {form.send_to.trim() || form.klub_email.trim()}
            </div>
          ) : (
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h2 className="admin-h2">Wyślij mailem</h2>
                  <p className="admin-subtitle">Edytuj treść — możesz dodać coś personalnego do klubu.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const { subject, body } = buildTemplate(form.klub_nazwa.trim())
                    setMailSubject(subject); setMailBody(body)
                  }}
                  className="admin-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  ↺ Przywróć szablon
                </button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="admin-label">Do</label>
                <input
                  className="admin-input"
                  type="email"
                  value={form.send_to || form.klub_email}
                  onChange={e => set('send_to', e.target.value)}
                  placeholder="email odbiorcy"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="admin-label">Temat</label>
                <input
                  className="admin-input"
                  type="text"
                  value={mailSubject}
                  onChange={e => setMailSubject(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label className="admin-label">Treść</label>
                <textarea
                  className="admin-input"
                  value={mailBody}
                  onChange={e => setMailBody(e.target.value)}
                  rows="14"
                  style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>

              <div style={{
                marginBottom: 12, padding: '8px 12px',
                background: '#F2F8FD', border: '1px solid #C9DCEF', borderRadius: 8,
                fontSize: 12, color: '#1E3A5F',
              }}>
                📎 Załącznik: <strong>{result.filename}</strong>
              </div>

              {error && (
                <div style={{
                  background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A',
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12,
                }}>{error}</div>
              )}

              <button
                onClick={sendEmail}
                disabled={sendStatus === 'sending' || (!form.send_to.trim() && !form.klub_email.trim())}
                className="admin-btn-primary"
                style={{ width: '100%' }}
              >
                {sendStatus === 'sending' ? 'Wysyłanie...' : '📧 Wyślij mailem'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
