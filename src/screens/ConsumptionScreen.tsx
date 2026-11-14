import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { formatLong, formatTime, MONTHS_FR, toISODate } from '../lib/dates'
import {
  consumptionEvents,
  dailySeries,
  monthlySeries,
  topProducts,
  trendPct,
  type Bucket,
} from '../lib/consumption'

type Mode = 'day' | 'month'

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  const name = MONTHS_FR[m - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`
}

function Chart({ data, selected, onSelect, every }: { data: Bucket[]; selected: string; onSelect: (k: string) => void; every: number }) {
  const max = Math.max(1, ...data.map((b) => b.value))
  return (
    <div className="conso-chart">
      {data.map((b, i) => (
        <button
          key={b.key}
          className={`conso-col${b.key === selected ? ' sel' : ''}`}
          onClick={() => onSelect(b.key)}
          aria-label={`${b.key} : ${b.value}`}
        >
          <span className="conso-bar-wrap">
            <span className="conso-bar" style={{ height: `${b.value ? Math.max(6, (b.value / max) * 100) : 2}%` }} />
          </span>
          <span className="conso-lbl">{i % every === 0 || b.key === selected ? b.label : ''}</span>
        </button>
      ))}
    </div>
  )
}

export function ConsumptionScreen({ onBack }: { onBack: () => void }) {
  const { history } = useStore()
  const events = useMemo(() => consumptionEvents(history), [history])
  const [mode, setMode] = useState<Mode>('day')
  const today = toISODate(new Date())
  const [selDay, setSelDay] = useState(today)
  const [selMonth, setSelMonth] = useState(today.slice(0, 7))

  const days = useMemo(() => dailySeries(events, 30), [events])
  const months = useMemo(() => monthlySeries(events, 12), [events])
  const series = mode === 'day' ? days : months
  const total = series.reduce((s, b) => s + b.value, 0)
  const avg = series.length ? total / series.length : 0

  // Tendance : 7 derniers jours vs 7 précédents, ou mois courant vs mois précédent.
  const trend =
    mode === 'day'
      ? trendPct(
          days.slice(-7).reduce((s, b) => s + b.value, 0),
          days.slice(-14, -7).reduce((s, b) => s + b.value, 0),
        )
      : trendPct(months[months.length - 1].value, months[months.length - 2].value)
  const trendText = mode === 'day' ? '7 derniers jours vs 7 précédents' : 'ce mois vs mois dernier'

  const selectedKey = mode === 'day' ? selDay : selMonth
  const picked = useMemo(
    () => events.filter((e) => (mode === 'day' ? e.date === selDay : e.date.startsWith(selMonth))),
    [events, mode, selDay, selMonth],
  )
  const pickedTotal = picked.reduce((s, e) => s + e.qty, 0)
  const top = useMemo(() => topProducts(picked, 5), [picked])
  const maxTop = Math.max(1, ...top.map((t) => t.qty))

  return (
    <div className="screen-fade">
      <PageHeader title="Consommation" onBack={onBack} />

      <div className="conso-seg">
        <button className={mode === 'day' ? 'on' : ''} onClick={() => setMode('day')}>Jour par jour</button>
        <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Mois par mois</button>
      </div>

      <div className="conso-kpis">
        <div className="stat-box"><div className="value">{total}</div><div className="label">{mode === 'day' ? 'sur 30 j' : 'sur 12 mois'}</div></div>
        <div className="stat-box"><div className="value">{avg < 10 ? avg.toFixed(1).replace('.', ',') : Math.round(avg)}</div><div className="label">{mode === 'day' ? 'par jour' : 'par mois'}</div></div>
        <div className={`stat-box${trend !== null && trend > 0 ? '' : ''}`}>
          <div className="value">{trend === null ? '–' : `${trend > 0 ? '+' : ''}${trend}%`}</div>
          <div className="label">tendance</div>
        </div>
      </div>
      <p className="conso-note">{trendText}</p>

      {events.length === 0 ? (
        <p className="chart-empty" style={{ padding: '0 20px' }}>
          Aucune consommation enregistrée pour l'instant. Chaque produit retiré du stock (bouton moins, scan, recette préparée) apparaîtra ici.
        </p>
      ) : (
        <>
          <div className="chart-section">
            <Chart
              data={series}
              selected={selectedKey}
              onSelect={(k) => (mode === 'day' ? setSelDay(k) : setSelMonth(k))}
              every={mode === 'day' ? 5 : 1}
            />
          </div>

          <div className="chart-section">
            <div className="chart-title">
              {mode === 'day' ? formatLong(selDay) : monthLabel(selMonth)} · {pickedTotal} unité{pickedTotal > 1 ? 's' : ''}
            </div>
            {picked.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>Rien consommé sur cette période.</p>
            ) : mode === 'month' ? (
              <div className="conso-top">
                {top.map((t) => (
                  <div className="conso-top-row" key={t.name}>
                    <span className="conso-top-name">{t.name}</span>
                    <span className="conso-top-track"><i style={{ width: `${(t.qty / maxTop) * 100}%` }} /></span>
                    <span className="conso-top-qty">×{t.qty}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ingredient-list">
                {picked.map((e) => (
                  <div className="ingredient-item" key={e.id}>
                    <Icon name="minus" width={2} />
                    <span className="ingredient-main">
                      <span>{e.name}</span>
                      <span className="ingredient-sub">{formatTime(e.at)}</span>
                    </span>
                    <span className="ingredient-qty">×{e.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
