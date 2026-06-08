import { Icon } from './Icon'

interface PageHeaderProps {
  title: string
  onBack: () => void
  action?: React.ReactNode
}

/** En-tête de sous-écran avec bouton retour. */
export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  return (
    <div className="page-header">
      <button className="back-btn" onClick={onBack} aria-label="Retour">
        <Icon name="back" />
      </button>
      <h1 style={{ flex: 1 }}>{title}</h1>
      {action}
    </div>
  )
}
