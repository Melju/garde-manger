import { useState } from 'react'
import { AVATARS, avatarUrl } from './MemberAvatar'

/** Feuille de choix d'avatar : personnes, animaux, ou retour à l'initiale. */
export function AvatarPicker({
  value,
  onPick,
  onClose,
}: {
  value?: string
  onPick: (id: string | undefined) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'personne' | 'animal'>(value?.startsWith('animal') ? 'animal' : 'personne')
  return (
    <div className="cselect-overlay" onClick={onClose}>
      <div className="cselect-sheet avatar-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cselect-handle" />
        <div className="cselect-title">Choisir un avatar</div>
        <div className="conso-seg" style={{ margin: '0 0 12px' }}>
          <button className={tab === 'personne' ? 'on' : ''} onClick={() => setTab('personne')}>Personnes</button>
          <button className={tab === 'animal' ? 'on' : ''} onClick={() => setTab('animal')}>Animaux</button>
        </div>
        <div className="avatar-grid">
          {AVATARS[tab].map((id) => (
            <button
              key={id}
              type="button"
              className={`avatar-opt${value === id ? ' on' : ''}`}
              onClick={() => onPick(id)}
              aria-label="Avatar"
            >
              <img src={avatarUrl(id)} alt="" loading="lazy" draggable={false} />
            </button>
          ))}
        </div>
        <button type="button" className="btn-secondary avatar-reset" onClick={() => onPick(undefined)}>
          Utiliser l'initiale
        </button>
      </div>
    </div>
  )
}
