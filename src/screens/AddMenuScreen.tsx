import { PageHeader } from '../components/PageHeader'
import { Icon, type IconName } from '../components/Icon'

interface AddMenuScreenProps {
  onBack: () => void
  onBarcode: () => void
  onTicket: () => void
  onTicketEmail: () => void
  onManual: () => void
}

export function AddMenuScreen({
  onBack,
  onBarcode,
  onTicket,
  onTicketEmail,
  onManual,
}: AddMenuScreenProps) {
  const items: { icon: IconName; title: string; desc: string; onClick: () => void; soon?: boolean }[] = [
    {
      icon: 'scan',
      title: 'Scanner un code-barres',
      desc: "Ajout rapide d'un produit individuel",
      onClick: onBarcode,
    },
    {
      icon: 'receipt',
      title: 'Scanner un ticket de caisse',
      desc: 'Ajout en lot après les courses (Claude Vision)',
      onClick: onTicket,
    },
    {
      icon: 'bell',
      title: 'Ticket électronique',
      desc: 'Importez depuis e-mail ou application',
      onClick: onTicketEmail,
      soon: true,
    },
    {
      icon: 'pencil',
      title: 'Saisie manuelle',
      desc: 'Pour le vrac, fait-maison ou restes',
      onClick: onManual,
    },
  ]

  return (
    <div className="screen-fade">
      <PageHeader title="Ajouter des produits" onBack={onBack} />
      <div className="product-list">
        {items.map((it) => (
          <div className="menu-item" key={it.title} onClick={it.onClick}>
            <div className="menu-icon">
              <Icon name={it.icon} />
            </div>
            <div className="menu-info">
              <div className="menu-title">
                {it.title}
                {it.soon && <span className="menu-badge" style={{ background: 'var(--muted)', marginLeft: 8 }}>bientôt</span>}
              </div>
              <div className="menu-desc">{it.desc}</div>
            </div>
            <Icon name="chevron" className="chevron" />
          </div>
        ))}
      </div>
    </div>
  )
}
