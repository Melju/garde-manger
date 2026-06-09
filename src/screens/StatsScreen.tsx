import { useMemo } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { monthlyStats, nutritionStats } from '../lib/analytics'
import { formatMonthYear, formatTime, fromISODate, MONTHS_FR } from '../lib/dates'

interface StatsScreenProps {
  onBack: () => void
  onOpenWaste: () => void
}

export function StatsScreen({ onBack, onOpenWaste }: StatsScreenProps) {
  const { products, history, expenses, undoHistory } = useStore()
  const toast = useToast()
  const stats = useMemo(() => monthlyStats(products, history, expenses), [products, history, expenses])
  const nut = useMemo(() => nutritionStats(products), [products])
  const maxWeek = Math.max(1, ...stats.weekly)
  const recent = history.slice(0, 8)

  return (
    <div className="screen-fade">
      <header className="page-header">
        <button className="back-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1 style={{ flex: 1 }}>Statistiques</h1>
        <button className="icon-btn" onClick={onOpenWaste} aria-label="Anti-gaspillage">
          <Icon name="recycle" />
        </button>
      </header>

      <p style={{ padding: '0 20px 16px', color: 'var(--muted)', fontSize: 13, marginTop: -8 }}>
        {formatMonthYear()}
      </p>

      <div className="stats-cards">
        <div className="stats-card">
          <div className="value">{stats.productsCount}</div>
          <div className="label">Produits en stock</div>
        </div>
        <div className="stats-card">
          <div className="value success">{stats.consumptionRate}%</div>
          <div className="label">Taux de consommation</div>
        </div>
        <div className="stats-card">
          <div className="value danger">{stats.wasted}</div>
          <div className="label">Produits jetés</div>
        </div>
        <div className="stats-card">
          <div className="value">{stats.expenses}€</div>
          <div className="label">Dépenses</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-title">Consommation par semaine</div>
        {stats.weekly.every((v) => v === 0) ? (
          <p className="chart-empty">
            Pas encore de consommation enregistrée ce mois-ci. Retire des produits (swipe, scan ou « consommé ») pour voir la courbe se remplir.
          </p>
        ) : (
          <div className="chart-placeholder">
            {stats.weekly.map((v, i) => (
              <div
                key={i}
                className="chart-bar"
                style={{ height: `${Math.max(4, (v / maxWeek) * 100)}%` }}
                data-label={`S${i + 1}`}
              >
                <span className="bar-val">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="chart-section">
        <div className="chart-title">Tendance alimentaire</div>
        {nut.count === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Scanne des produits pour suivre ta tendance « manger sain » (basée sur le Nutri-Score).
          </p>
        ) : (
          <div className="health-card">
            <div className="health-head">
              <div>
                <div className="health-score">
                  {nut.healthScore}
                  <span>/100</span>
                </div>
                <div className="health-verdict">{nut.verdict}</div>
              </div>
              <span className={`nutri-badge ns-${nut.grade}`}>{nut.grade.toUpperCase()}</span>
            </div>
            <div className="health-bar">
              {nut.distribution
                .filter((d) => d.count > 0)
                .map((d) => (
                  <span key={d.grade} className={`hb ns-${d.grade}`} style={{ flexGrow: d.count }} />
                ))}
            </div>
            <div className="health-legend">
              {nut.distribution.map((d) => (
                <span key={d.grade}>
                  <i className={`dot ns-${d.grade}`} />
                  {d.grade.toUpperCase()} {d.count}
                </span>
              ))}
            </div>
            <p className="health-note">{nut.count} produit(s) avec Nutri-Score</p>
          </div>
        )}
      </div>

      <div className="history-section">
        <div className="history-title">Historique récent</div>
        {recent.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Aucune activité pour l'instant.</p>
        ) : (
          recent.map((h) => {
            const d = fromISODate(h.date)
            return (
              <div className="history-item" key={h.id}>
                <div className="history-date">
                  <div className="day">{d.getDate()}</div>
                  <div className="month">{MONTHS_FR[d.getMonth()].slice(0, 4)}</div>
                </div>
                <div className="history-content">
                  <div className="history-action">{h.label}</div>
                  <div className="history-time">{formatTime(h.at)}</div>
                </div>
                <button
                  className="history-undo"
                  aria-label="Corriger / annuler"
                  onClick={async () => {
                    const reversible = h.kind === 'consomme' || h.kind === 'jete' || h.kind === 'ajoute'
                    const msg = reversible
                      ? 'Annuler cette action et corriger le stock ?'
                      : 'Retirer cette entrée de l’historique ?'
                    if (!confirm(msg)) return
                    await undoHistory(h)
                    toast(reversible ? 'Action annulée' : 'Entrée retirée')
                  }}
                >
                  <Icon name="back" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
