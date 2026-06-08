import { useMemo } from 'react'
import { useStore } from '../data/store'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { monthlyStats } from '../lib/analytics'
import { priorityProducts, expiryLabel } from '../lib/expiry'

interface WasteScreenProps {
  onBack: () => void
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent ! Vous êtes dans le top 15% des utilisateurs'
  if (score >= 70) return 'Très bien, continuez sur cette lancée'
  if (score >= 50) return 'Correct — quelques produits à mieux suivre'
  return 'À améliorer : pensez à consommer les produits en priorité'
}

export function WasteScreen({ onBack }: WasteScreenProps) {
  const { products, history, expenses } = useStore()
  const stats = useMemo(() => monthlyStats(products, history, expenses), [products, history, expenses])
  const tips = useMemo(() => priorityProducts(products).slice(0, 3), [products])

  return (
    <div className="screen-fade">
      <PageHeader title="Bilan anti-gaspillage" onBack={onBack} />

      <div className="waste-score">
        <div className="value">{stats.score}</div>
        <div className="label">Score anti-gaspi</div>
        <div className="desc">{scoreLabel(stats.score)}</div>
      </div>

      <div className="waste-stats">
        <div className="waste-stat">
          <div className="value success">{stats.consumed}</div>
          <div className="label">Produits sauvés ce mois</div>
        </div>
        <div className="waste-stat">
          <div className="value danger">{stats.wasted}</div>
          <div className="label">Produits jetés ce mois</div>
        </div>
        <div className="waste-stat">
          <div className="value success">{stats.savings}€</div>
          <div className="label">Économies réalisées</div>
        </div>
        <div className="waste-stat">
          <div className="value">{stats.co2}kg</div>
          <div className="label">CO₂ évité (estim.)</div>
        </div>
      </div>

      <div className="tips-section">
        <div className="tips-title">Conseils personnalisés</div>
        {tips.length === 0 ? (
          <div className="tip-card">
            <div className="tip-icon">
              <Icon name="checkCircle" />
            </div>
            <div className="tip-content">
              <h4>Rien d'urgent</h4>
              <p>Aucun produit ne périme bientôt. Beau travail !</p>
            </div>
          </div>
        ) : (
          tips.map((p) => (
            <div className="tip-card" key={p.id}>
              <div className="tip-icon">
                <Icon name="bulb" />
              </div>
              <div className="tip-content">
                <h4>{p.name} à consommer</h4>
                <p>
                  Expire {expiryLabel(p).toLowerCase()}. Cuisinez-le ou congelez-le pour éviter le
                  gaspillage.
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
