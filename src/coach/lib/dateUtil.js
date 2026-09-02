// Minimalne narzędzia datowe (PL, tygodnie zaczynają w poniedziałek)

export const PL_DAY_SHORT = ['Nd','Pon','Wt','Śr','Czw','Pt','Sob']

export function startOfDay(d) {
  const x = new Date(d); x.setHours(0,0,0,0); return x
}
export function startOfWeek(d) {
  const x = startOfDay(d)
  const day = x.getDay()                // 0=Nd, 1=Pon, ...
  const offset = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + offset)
  return x
}
export function startOfMonth(d) {
  const x = startOfDay(d); x.setDate(1); return x
}
export function addDays(d, n) {
  const x = new Date(d); x.setDate(x.getDate() + n); return x
}
export function addMonths(d, n) {
  const x = new Date(d); x.setMonth(x.getMonth() + n); return x
}
export function sameDay(a, b) {
  return startOfDay(a).getTime() === startOfDay(b).getTime()
}

export function formatTime(d) {
  return new Date(d).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
}
export function formatDateShort(d) {
  return new Date(d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
}
export function formatMonthYear(d) {
  return new Date(d).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
}
export function formatWeekRange(monday) {
  const sunday = addDays(monday, 6)
  const sameMonth = monday.getMonth() === sunday.getMonth()
  if (sameMonth) {
    return `${monday.getDate()}–${sunday.getDate()} ${monday.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}`
  }
  return `${monday.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

// HTML input "datetime-local" oczekuje "YYYY-MM-DDTHH:mm" w lokalnej strefie
export function toLocalInput(date) {
  const d = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function fromLocalInput(value) {
  // "2026-05-15T18:00" → Date w lokalnej strefie
  return new Date(value)
}
