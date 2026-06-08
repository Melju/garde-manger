import { useMemo } from 'react'
import { useStore } from '../data/store'
import { Icon, type IconName } from '../components/Icon'
import { buildNotifications } from '../lib/analytics'
import { budgetSummary } from '../lib/analytics'
import { monthlyStats } from '../lib/analytics'

interface MoreScreenProps {
  onFamily: () => void
  onStats: () => void
  onPlanning: () => void
  onNotifications: () => void
  onWaste: () => void
  onBudget: () => void
  onSettings: () => void
}

export function MoreScreen(props: MoreScreenProps) {
  const { products, settings, expenses, budget, history } = useStore()
  const notifCount = useMemo(
    () => buildNotifications(products, settings).length,
    [products, settings],
  )
  const spent = useMemo(() => budgetSummary(expenses, budget).spent, [expenses, budget])
  const score = useMemo(() => monthlyStats(products, history, expenses).score, [products, history, expenses])

  const items: {
    icon: IconName
    title: string
    desc: string
    onClick: () => void
    badge?: number
  }[] = [
    { icon: 'users', title: 'Famille', desc: 'Gérer les profils et régimes', onClick: props.onFamily },
    { icon: 'chart', title: 'Statistiques', desc: 'Historique et consommation', onClick: props.onStats },
    { icon: 'calendar', title: 'Planning repas', desc: 'Planifier la semaine', onClick: props.onPlanning },
    {
      icon: 'bell',
      title: 'Notifications',
      desc: notifCount > 0 ? `${notifCount} alerte${notifCount > 1 ? 's' : ''}` : 'Aucune alerte',
      onClick: props.onNotifications,
      badge: notifCount || undefined,
    },
    { icon: 'recycle', title: 'Anti-gaspillage', desc: `Score ${score}/100`, onClick: props.onWaste },
    { icon: 'wallet', title: 'Budget', desc: `${spent}€ ce mois`, onClick: props.onBudget },
    { icon: 'cog', title: 'Paramètres', desc: 'Notifications, données', onClick: props.onSettings },
  ]

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Plus</h1>
        </div>
      </header>

      <div className="product-list">
        {items.map((it) => (
          <div className="menu-item" key={it.title} onClick={it.onClick}>
            <div className="menu-icon">
              <Icon name={it.icon} />
            </div>
            <div className="menu-info">
              <div className="menu-title">{it.title}</div>
              <div className="menu-desc">{it.desc}</div>
            </div>
            {it.badge && <span className="menu-badge">{it.badge}</span>}
            <Icon name="chevron" className="chevron" />
          </div>
        ))}
      </div>
    </div>
  )
}
