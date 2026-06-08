import { useStore } from '../data/store'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { DIET_LABELS, type FamilyMember } from '../types'

interface FamilyScreenProps {
  onBack: () => void
  onEditMember: (member: FamilyMember | null) => void
}

export function FamilyScreen({ onBack, onEditMember }: FamilyScreenProps) {
  const { family } = useStore()

  return (
    <div className="screen-fade">
      <PageHeader title="Famille" onBack={onBack} />

      <div className="product-list">
        {family.map((m) => (
          <div className="family-member" key={m.id} onClick={() => onEditMember(m)}>
            <div className="member-avatar large" style={{ background: m.color }}>
              {m.name.charAt(0).toUpperCase()}
            </div>
            <div className="member-info">
              <div className="member-name">{m.name}</div>
              <div className="member-diet">{DIET_LABELS[m.diet]}</div>
            </div>
            {(m.diet !== 'omnivore' || m.restrictions.length > 0) && (
              <div className="member-badges">
                {m.diet !== 'omnivore' && <span className="diet-badge veg">{DIET_LABELS[m.diet]}</span>}
                {m.restrictions.slice(0, 1).map((r) => (
                  <span className="diet-badge allergy" key={r}>
                    {r}
                  </span>
                ))}
              </div>
            )}
            <Icon name="chevron" className="chevron" />
          </div>
        ))}

        <button className="add-member-btn" onClick={() => onEditMember(null)}>
          <Icon name="plus" />
          Ajouter un membre
        </button>
      </div>
    </div>
  )
}
