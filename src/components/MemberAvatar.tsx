import type { FamilyMember } from '../types'

/** Avatars disponibles (fichiers public/avatars/<id>.webp). */
export const AVATARS = {
  personne: Array.from({ length: 25 }, (_, i) => `personne-${String(i + 1).padStart(2, '0')}`),
  animal: Array.from({ length: 25 }, (_, i) => `animal-${String(i + 1).padStart(2, '0')}`),
}

export function avatarUrl(id: string): string {
  return `/avatars/${id}.webp`
}

/** Avatar d'un membre : image choisie, sinon initiale sur fond de couleur. */
export function MemberAvatar({
  member,
  size = 'sm',
  style,
}: {
  member: Pick<FamilyMember, 'name' | 'color' | 'avatar'>
  size?: 'sm' | 'large'
  style?: React.CSSProperties
}) {
  if (member.avatar) {
    return (
      <div className={`member-avatar has-img${size === 'large' ? ' large' : ''}`} style={style}>
        <img src={avatarUrl(member.avatar)} alt="" draggable={false} />
      </div>
    )
  }
  return (
    <div className={`member-avatar${size === 'large' ? ' large' : ''}`} style={{ background: member.color, ...style }}>
      {(member.name.charAt(0) || '?').toUpperCase()}
    </div>
  )
}
