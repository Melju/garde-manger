import { useState } from 'react'
import { MONTHS_FR, addDays, formatLong, fromISODate, toISODate } from '../lib/dates'
import { Icon } from './Icon'

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** Calendrier maison (remplace le sélecteur natif du navigateur). */
export function DatePicker({
  value,
  onChange,
  id,
}: {
  value: string
  onChange: (iso: string) => void
  id?: string
}) {
  const [open, setOpen] = useState(false)
  const base = value ? fromISODate(value) : new Date()
  const [view, setView] = useState(new Date(base.getFullYear(), base.getMonth(), 1))
  const today = toISODate(new Date())

  const first = view
  const offset = (first.getDay() + 6) % 7 // lundi = 0
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(first.getFullYear(), first.getMonth(), i + 1)),
    ),
  ]

  function pick(iso: string) {
    onChange(iso)
    setOpen(false)
  }
  const shift = (n: number) => setView(new Date(first.getFullYear(), first.getMonth() + n, 1))

  const quick: [string, number][] = [
    ['Demain', 1],
    ['+3 j', 3],
    ['+1 sem.', 7],
    ['+1 mois', 30],
  ]

  return (
    <div className="dp">
      <button
        id={id}
        type="button"
        className={`form-input dp-field${value ? '' : ' empty'}`}
        onClick={() => {
          setView(new Date(base.getFullYear(), base.getMonth(), 1))
          setOpen((o) => !o)
        }}
      >
        <span>{value ? formatLong(value) : 'Choisir une date'}</span>
        <span className="dp-ico" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => shift(-1)} aria-label="Mois précédent">
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevron" width={2.4} /></span>
            </button>
            <strong>
              {MONTHS_FR[first.getMonth()]} {first.getFullYear()}
            </strong>
            <button type="button" className="dp-nav" onClick={() => shift(1)} aria-label="Mois suivant">
              <Icon name="chevron" width={2.4} />
            </button>
          </div>
          <div className="dp-grid dp-week">
            {WEEK.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="dp-grid">
            {cells.map((iso, i) =>
              iso ? (
                <button
                  key={iso}
                  type="button"
                  className={`dp-day${iso === value ? ' sel' : ''}${iso === today ? ' today' : ''}`}
                  onClick={() => pick(iso)}
                >
                  {Number(iso.slice(8))}
                </button>
              ) : (
                <span key={'e' + i} />
              ),
            )}
          </div>
          <div className="dp-quick">
            {quick.map(([label, n]) => (
              <button key={label} type="button" onClick={() => pick(toISODate(addDays(new Date(), n)))}>
                {label}
              </button>
            ))}
            {value && (
              <button type="button" className="clear" onClick={() => pick('')}>
                Effacer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
