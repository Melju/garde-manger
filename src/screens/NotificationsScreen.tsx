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
  const { notifications, markNotificationsRead, dismissNotifications } = useStore()
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

      {list.length > 0 && (
        <div className="notif-actions">
          <button className="notif-clear" onClick={() => dismissNotifications(list.map((n) => n.id))}>
            Tout effacer{tab === 'toutes' ? '' : ' dans cet onglet'}
          </button>
        </div>
      )}

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
              <button className="notif-dismiss" aria-label="Effacer" onClick={() => dismissNotifications([n.id])}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
