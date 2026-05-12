import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { toLocalInput, fromLocalInput } from '../lib/dateUtil'

const CATEGORIES = [
  { value: '',            label: '— Brak —' },
  { value: 'general',     label: 'Trening ogólny' },
  { value: 'shooting',    label: 'Strzały' },
  { value: 'dribbling',   label: 'Drybling' },
  { value: 'athleticism', label: 'Atletyzm' },
  { value: 'conditioning',label: 'Kondycja' },
  { value: 'strength',    label: 'Siła' },
  { value: 'iq',          label: 'IQ koszykarski' },
  { value: 'recovery',    label: 'Regeneracja' },
  { value: 'match',       label: 'Mecz / Sparing' },
]

/**
 * Modal do tworzenia / edycji / usuwania pojedynczego treningu drużynowego.
 *
 * Props:
 *   teamId        — uuid drużyny
 *   defaultDate   — Date (data początkowa — z klikniętej komórki kalendarza)
 *   practice      — istniejący wiersz (gdy edycja); null = tryb add
 *   onClose       — zamknij bez zapisu
 *   onSaved       — { practice } po zapisie
 *   onDeleted     — po usunięciu (tylko w edycji)
 */
export default function PracticeFormModal({ teamId, defaultDate, practice, onClose, onSaved, onDeleted }) {
  const isEdit = !!practice
  const initialDate = practice?.scheduled_at
    ? new Date(practice.scheduled_at)
    : (defaultDate || new Date())

  // Domyślna godzina dla nowego: 18:00 (typowa pora treningu)
  const initialDateAdjusted = practice
    ? initialDate
    : (() => {
        const d = new Date(initialDate)
        if (d.getHours() === 0 && d.getMinutes() === 0) {
          d.setHours(18, 0, 0, 0)
        }
        return d
      })()

  const [scheduledAt, setScheduledAt] = useState(toLocalInput(initialDateAdjusted))
  const [duration, setDuration]       = useState(practice?.duration_min ?? 90)
  const [category, setCategory]       = useState(practice?.category || '')
  const [location, setLocation]       = useState(practice?.location || '')
  const [notes, setNotes]             = useState(practice?.notes || '')
  const [submitting, setSubmitting]   = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [error, setError]             = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setSubmitting(true)
    const payload = {
      team_id:      teamId,
      scheduled_at: fromLocalInput(scheduledAt).toISOString(),
      duration_min: duration === '' ? null : parseInt(duration, 10),
      category:     category || null,
      location:     location.trim() || null,
      notes:        notes.trim()    || null,
    }
    let res
    if (isEdit) {
      res = await supabase.from('team_practice').update(payload).eq('id', practice.id).select().single()
    } else {
      res = await supabase.from('team_practice').insert(payload).select().single()
    }
    setSubmitting(false)
    if (res.error) { setError(res.error.message); return }
    onSaved?.(res.data)
  }

  const remove = async () => {
    setDeleting(true)
    const { error } = await supabase.from('team_practice').delete().eq('id', practice.id)
    setDeleting(false)
    if (error) { setError(error.message); setConfirmDelete(false); return }
    onDeleted?.()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(20, 35, 60, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF', width: '100%', maxWidth: 480,
        borderRadius: 18, padding: 28, maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>
          {isEdit ? 'Edytuj trening' : 'Nowy trening'}
        </h2>
        <p className="coach-subtitle" style={{ marginBottom: 20 }}>
          Pojawi się w aplikacjach zawodników w dniu treningu.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Data i godzina *</label>
            <input
              className="coach-input"
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="coach-label">Czas trwania (min)</label>
              <input
                className="coach-input"
                type="number" min="0" max="600" step="5"
                value={duration}
                onChange={e => setDuration(e.target.value)}
              />
            </div>
            <div>
              <label className="coach-label">Kategoria</label>
              <select className="coach-input" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="coach-label">Lokalizacja</label>
            <input
              className="coach-input"
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="np. Hala Mokotów"
            />
          </div>
          <div>
            <label className="coach-label">Notatki dla drużyny</label>
            <textarea
              className="coach-input"
              rows="3"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="np. Zabierzcie buty halowe i butelkę wody."
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="coach-btn-secondary" style={{ flex: 1 }}>Anuluj</button>
            <button type="submit" disabled={submitting} className="coach-btn-primary" style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Zapisywanie...' : isEdit ? 'Zapisz zmiany' : 'Utwórz trening'}
            </button>
          </div>

          {isEdit && (
            <div style={{ paddingTop: 14, marginTop: 6, borderTop: '1px solid #E6ECF3' }}>
              {confirmDelete ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="coach-btn-secondary" style={{ flex: 1 }}>
                    Nie usuwaj
                  </button>
                  <button type="button" onClick={remove} disabled={deleting} style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #D85546',
                    background: '#D85546', color: '#FFFFFF', fontWeight: 600, fontSize: 14,
                    cursor: 'pointer', opacity: deleting ? 0.6 : 1,
                  }}>
                    {deleting ? 'Usuwanie...' : 'Tak, usuń trening'}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} style={{
                  width: '100%', padding: '8px 14px', borderRadius: 10,
                  border: 'none', background: 'transparent',
                  color: '#D85546', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Usuń ten trening
                </button>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export { CATEGORIES as PRACTICE_CATEGORIES }
