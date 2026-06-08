// Utilitaires de dates en français (sans dépendance externe).

export const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

export const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

/** Date ISO (YYYY-MM-DD) d'un objet Date, en heure locale. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse une date ISO (YYYY-MM-DD) en Date locale (minuit). */
export function fromISODate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

/** « 9 juin 2026 ». */
export function formatLong(iso: string): string {
  const d = fromISODate(iso)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`
}

/** « 9 juin ». */
export function formatDayMonth(iso: string): string {
  const d = fromISODate(iso)
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]}`
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay() // 0 = dimanche
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

/** Ajoute `n` jours à une date (renvoie une nouvelle Date). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Les 7 jours (lundi → dimanche) de la semaine de `ref`, en ISO. */
export function weekDays(ref: Date): string[] {
  const start = startOfWeek(ref)
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(start, i)))
}

/** Clé de mois « YYYY-MM ». */
export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

/** « Juin 2026 » (capitalisé). */
export function formatMonthYear(d: Date = new Date()): string {
  const m = MONTHS_FR[d.getMonth()]
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`
}

/** Heure « 14:32 ». */
export function formatTime(isoDateTime: string): string {
  const d = new Date(isoDateTime)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
