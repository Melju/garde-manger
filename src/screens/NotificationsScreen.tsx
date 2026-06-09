import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { PageHeader } from '../components/PageHeader'
import { Icon, type IconName } from '../components/Icon'
import { type NotifKind, type NotifSeverity } from '../lib/analytics'

interface NotificationsScreenProps {
  onBack: () => void
}

const ICON_BY_SEVERITY: Record<NotifSeverity, IconName> = {
  danger: 'alert',
  warn: 'clock',
  success: 'checkCircle',
  info: 'cart',
}

type Tab = 'toutes' | NotifKind

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const { notifications, markNotificationsRead } = useStore()
  const [tab, setTab] = useState<Tab>('toutes')

  // À l'ouverture, on marque les notifications comme vues (efface le badge).
  useEffect(() => {
    markNotificationsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const list = notifications.filter((n) => tab === 'toutes' || n.kind === tab)

  return (
    <div className="screen-fade">
      <PageHeader title="Notifications" onBack={onBack} />

      <div className="notif-tabs">
        {([
          ['toutes', 'Toutes'],
          ['peremption', 'Péremptions'],
          ['stock', 'Stock bas'],
        ] as [Tab, string][]).map(([id, label]) => (
          <button
            key={id}
            className={`notif-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="notif-list">
        {list.length === 0 ? (
          <div className="empty-state">
            <Icon name="checkCircle" />
            <p>Aucune notification. Tout est sous contrôle !</p>
          </div>
        ) : (
          list.map((n) => (
            <div key={n.id} className={`notif-item${n.severity !== 'info' ? ' unread' : ''}`}>
              <div className={`notif-icon ${n.severity}`}>
                <Icon name={ICON_BY_SEVERITY[n.severity]} />
              </div>
              <div className="notif-content">
                <div className="notif-title">{n.title}</div>
                <div className="notif-desc">{n.desc}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
