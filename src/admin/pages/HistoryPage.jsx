import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function HistoryPage() {
  const [items, setItems] = useState(null)   // null = loading
  const [error, setError] = useState(null)
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = async () => {
    setError(null)
    const { data, error } = await supabase
      .from('admin_contracts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { setError(error.message); setItems([]); return }
    setItems(data || [])
  }

  useEffect(() => { load() }, [])

  const openPdf = async (path) => {
    const { data, error } = await supabase.storage
      .from('admin_contracts')
      .createSignedUrl(path, 600)   // 10-minute signed URL
    if (error) { setError('Nie udało się otworzyć PDF: ' + error.message); return }
    setSelectedUrl(data?.signedUrl || null)
  }

  const remove = async (item) => {
    if (!confirm(`Usunąć ${item.klub_nazwa}? Tej operacji nie da się cofnąć.`)) return
    setDeletingId(item.id)
    try {
      if (item.pdf_path) {
        await supabase.storage.from('admin_contracts').remove([item.pdf_path])
      }
      await supabase.from('admin_contracts').delete().eq('id', item.id)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDateTime = (iso) => {
    const d = new Date(iso)
    return d.toLocaleString('pl-PL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="admin-h1">Historia umów {items && <span style={{ color: '#8A9AB0', fontWeight: 500, fontSize: 18 }}>({items.length})</span>}</h1>
          <p className="admin-subtitle">Wystawione umowy z możliwością podglądu PDF.</p>
        </div>
        <button onClick={load} className="admin-btn-secondary">Odśwież</button>
      </header>

      {error && (
        <div className="admin-card" style={{
          marginBottom: 14, background: '#FCE5E2', borderColor: '#F4B5AB', color: '#A1372A', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {items === null ? (
        <div className="admin-card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner"/>
        </div>
      ) : items.length === 0 ? (
        <div className="admin-card" style={{ padding: 40, textAlign: 'center', color: '#8A9AB0' }}>
          Brak wygenerowanych umów.
        </div>
      ) : (
        <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
          {items.map((it, idx) => (
            <div key={it.id} style={{
              padding: 16, borderTop: idx > 0 ? '1px solid #E6ECF3' : 'none',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233' }}>
                  {it.klub_nazwa}
                </div>
                <div style={{ fontSize: 12, color: '#8A9AB0', marginTop: 2 }}>
                  {formatDateTime(it.created_at)}
                  {it.klub_nip && ` · NIP ${it.klub_nip}`}
                </div>
                {it.sent_at && (
                  <div style={{ fontSize: 11, color: '#3FA86A', marginTop: 4, fontWeight: 600 }}>
                    ✓ Wysłano {it.sent_to ? `do ${it.sent_to}` : ''} ({formatDateTime(it.sent_at)})
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {it.pdf_path && (
                  <button onClick={() => openPdf(it.pdf_path)} className="admin-btn-secondary"
                    style={{ padding: '8px 14px', fontSize: 13 }}>
                    👁️ Podgląd
                  </button>
                )}
                <button onClick={() => remove(it)} disabled={deletingId === it.id}
                  className="admin-btn-secondary"
                  style={{ padding: '8px 14px', fontSize: 13, color: '#D85546', borderColor: '#F4B5AB' }}>
                  {deletingId === it.id ? '...' : 'Usuń'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUrl && (
        <div onClick={() => setSelectedUrl(null)} style={{
          position: 'fixed', inset: 0, zIndex: 200, padding: 24,
          background: 'rgba(20,35,60,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#FFFFFF', width: '100%', maxWidth: 900, height: '92vh',
            borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '10px 14px', borderBottom: '1px solid #E6ECF3',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#1A2233' }}>Podgląd PDF</span>
              <button onClick={() => setSelectedUrl(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#8A9AB0' }}>×</button>
            </div>
            <iframe src={selectedUrl} title="contract pdf" style={{ flex: 1, border: 'none' }}/>
          </div>
        </div>
      )}
    </div>
  )
}
