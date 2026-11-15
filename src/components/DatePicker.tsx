import { useState } from 'react'
import { MONTHS_FR, addDays, formatLong, fromISODate, toISODate } from '../lib/dates'
import { Icon } from './Icon'

const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

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
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days')
  const [yearStart, setYearStart] = useState(0)
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
  // Choisir un mois ou une année change aussi la date du champ (même jour, ramené à la fin du mois si besoin).
  function setMonthYear(y: number, m: number) {
    setView(new Date(y, m, 1))
    setMode('days')
    if (value) {
      const day = Math.min(fromISODate(value).getDate(), new Date(y, m + 1, 0).getDate())
      onChange(toISODate(new Date(y, m, day)))
    }
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
          setMode('days')
          setOpen((o) => !o)
        }}
      >
        <span>{value ? formatLong(value) : 'Choisir une date'}</span>
        <span className="dp-ico" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="dp-pop">
          <div className="dp-head">
            <button
              type="button"
              className="dp-nav"
              onClick={() => (mode === 'years' ? setYearStart((y) => y - 12) : mode === 'months' ? setView(new Date(first.getFullYear() - 1, first.getMonth(), 1)) : shift(-1))}
              aria-label="Précédent"
            >
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevron" width={2.4} /></span>
            </button>
            <div className="dp-title">
              <button type="button" className={`dp-pill${mode === 'months' ? ' on' : ''}`} onClick={() => setMode(mode === 'months' ? 'days' : 'months')}>
                {MONTHS_FR[first.getMonth()]} <span aria-hidden>▾</span>
              </button>
              <button
                type="button"
                className={`dp-pill${mode === 'years' ? ' on' : ''}`}
                onClick={() => {
                  setYearStart(first.getFullYear() - 4)
                  setMode(mode === 'years' ? 'days' : 'years')
                }}
              >
                {first.getFullYear()} <span aria-hidden>▾</span>
              </button>
            </div>
            <button
              type="button"
              className="dp-nav"
              onClick={() => (mode === 'years' ? setYearStart((y) => y + 12) : mode === 'months' ? setView(new Date(first.getFullYear() + 1, first.getMonth(), 1)) : shift(1))}
              aria-label="Suivant"
            >
              <Icon name="chevron" width={2.4} />
            </button>
          </div>
          {mode === 'months' && (
            <div className="dp-choices">
              {MONTHS_FR.map((m, i) => (
                <button
                  key={m}
                  type="button"
                  className={i === first.getMonth() ? 'sel' : ''}
                  onClick={() => setMonthYear(first.getFullYear(), i)}
                >
                  {MONTHS_SHORT[i]}
                </button>
              ))}
            </div>
          )}
          {mode === 'years' && (
            <div className="dp-choices">
              {Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  className={y === first.getFullYear() ? 'sel' : y === new Date().getFullYear() ? 'today' : ''}
                  onClick={() => setMonthYear(y, first.getMonth())}
                >
                  {y}
                </button>
              ))}
            </div>
          )}
          {mode === 'days' && (
          <>
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
          </>
          )}
        </div>
      )}
    </div>
  )
}
