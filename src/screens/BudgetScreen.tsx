import { useMemo } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { budgetSummary } from '../lib/analytics'
import { formatMonthYear } from '../lib/dates'

interface BudgetScreenProps {
  onBack: () => void
}

export function BudgetScreen({ onBack }: BudgetScreenProps) {
  const { expenses, budget, setBudgetLimit } = useStore()
  const toast = useToast()
  const summary = useMemo(() => budgetSummary(expenses, budget), [expenses, budget])

  const fillClass =
    summary.ratio >= 0.9 ? 'danger' : summary.ratio >= 0.7 ? 'warning' : ''

  async function editLimit() {
    const value = window.prompt('Plafond mensuel (€)', String(budget.monthlyLimit))
    if (value === null) return
    const n = Math.max(0, Math.round(Number(value)))
    if (!Number.isFinite(n) || n === 0) return
    await setBudgetLimit(n)
    toast('Plafond mis à jour')
  }

  return (
    <div className="screen-fade">
      <PageHeader
        title="Budget alimentaire"
        onBack={onBack}
        action={
          <button className="icon-btn" onClick={editLimit} aria-label="Modifier le plafond">
            <Icon name="pencil" />
          </button>
        }
      />

      <div className="budget-overview">
        <div className="budget-header">
          <div>
            <div className="budget-spent">{summary.spent}€</div>
            <div className="budget-limit">sur {summary.limit}€ prévus</div>
          </div>
          <span className="budget-period">{formatMonthYear()}</span>
        </div>
        <div className="budget-bar">
          <div
            className={`budget-bar-fill ${fillClass}`}
            style={{ width: `${Math.round(summary.ratio * 100)}%` }}
          />
        </div>
        <div className="budget-remaining">
          {summary.remaining >= 0
            ? `Il reste ${summary.remaining}€ pour ${summary.daysLeft} jours`
            : `Dépassement de ${-summary.remaining}€`}
        </div>
      </div>

      <div className="budget-categories">
        <div className="budget-cat-title">Répartition par catégorie</div>
        {summary.byCategory.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Aucune dépense ce mois. Ajoutez un prix lors de l'ajout d'un produit.
          </p>
        ) : (
          summary.byCategory.map((c) => (
            <div className="budget-cat-item" key={c.category}>
              <div className="budget-cat-icon">
                <Icon name="box" width={1.5} />
              </div>
              <div className="budget-cat-info">
                <div className="budget-cat-name">{c.label}</div>
                <div className="budget-cat-bar">
                  <div className="budget-cat-bar-fill" style={{ width: `${Math.round(c.ratio * 100)}%` }} />
                </div>
              </div>
              <span className="budget-cat-amount">{c.amount}€</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
