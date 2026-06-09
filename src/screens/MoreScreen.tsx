import { useMemo } from 'react'
import { useStore } from '../data/store'
import { useAuth } from '../data/auth'
import { Icon, type IconName } from '../components/Icon'
import { budgetSummary } from '../lib/analytics'
import { monthlyStats } from '../lib/analytics'

interface MoreScreenProps {
  onFamily: () => void
  onStats: () => void
  onNotifications: () => void
  onWaste: () => void
  onBudget: () => void
  onSettings: () => void
  onAccount: () => void
}

export function MoreScreen(props: MoreScreenProps) {
  const { products, expenses, budget, history, unreadNotifCount } = useStore()
  const auth = useAuth()
  const notifCount = unreadNotifCount
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
    {
      icon: 'users',
      title: 'Compte & famille (cloud)',
      desc: auth.user
        ? auth.householdId
          ? `Connecté · ${auth.user.email}`
          : 'Connecté — crée ou rejoins un foyer'
        : auth.cloudEnabled
          ? 'Se connecter pour synchroniser'
          : 'Stockage local',
      onClick: props.onAccount,
    },
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
