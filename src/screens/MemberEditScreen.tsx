import { useState } from 'react'
import { useStore, AVATAR_COLORS } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { DIETS, RESTRICTIONS, type Diet, type FamilyMember } from '../types'

interface MemberEditScreenProps {
  member: FamilyMember | null
  onBack: () => void
}

export function MemberEditScreen({ member, onBack }: MemberEditScreenProps) {
  const { addMember, updateMember, removeMember, family } = useStore()
  const toast = useToast()
  const isEdit = member !== null

  const [name, setName] = useState(member?.name ?? '')
  const [diet, setDiet] = useState<Diet>(member?.diet ?? 'omnivore')
  const [restrictions, setRestrictions] = useState<string[]>(member?.restrictions ?? [])
  const [aversions, setAversions] = useState(member?.aversions ?? '')

  const canSave = name.trim().length > 0

  function toggleRestriction(r: string) {
    setRestrictions((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))
  }

  async function save() {
    if (!canSave) return
    const data = {
      name: name.trim(),
      diet,
      restrictions,
      aversions: aversions.trim() || undefined,
    }
    if (isEdit && member) {
      await updateMember(member.id, data)
      toast('Profil enregistré')
    } else {
      const color = AVATAR_COLORS[family.length % AVATAR_COLORS.length]
      await addMember({ ...data, color })
      toast('Membre ajouté')
    }
    onBack()
  }

  async function del() {
    if (!member) return
    if (!confirm(`Supprimer ${member.name} ?`)) return
    await removeMember(member.id)
    toast('Membre supprimé')
    onBack()
  }

  const color = member?.color ?? AVATAR_COLORS[family.length % AVATAR_COLORS.length]

  return (
    <div className="screen-fade">
      <PageHeader title="Profil" onBack={onBack} />

      <div className="form-section" style={{ textAlign: 'center', paddingTop: 20 }}>
        <div
          className="member-avatar large"
          style={{ background: color, width: 80, height: 80, fontSize: 32, margin: '0 auto' }}
        >
          {(name.charAt(0) || '?').toUpperCase()}
        </div>
      </div>

      <div className="form-section">
        <div className="form-group">
          <label className="form-label">Prénom</label>
          <input
            className="form-input"
            value={name}
            autoFocus={!isEdit}
            placeholder="Ex : Camille"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Régime alimentaire</label>
          <div className="diet-options">
            {DIETS.map((d) => (
              <button
                key={d.id}
                className={`diet-option${diet === d.id ? ' active' : ''}`}
                onClick={() => setDiet(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Restrictions / Allergies</label>
          <div className="restriction-options">
            {RESTRICTIONS.map((r) => (
              <button
                key={r}
                className={`restriction-option${restrictions.includes(r) ? ' active' : ''}`}
                onClick={() => toggleRestriction(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Aversions (optionnel)</label>
          <input
            className="form-input"
            placeholder="Ex : champignons, coriandre..."
            value={aversions}
            onChange={(e) => setAversions(e.target.value)}
          />
        </div>
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn-secondary" onClick={onBack}>
          Annuler
        </button>
        <button className="btn-primary" disabled={!canSave} onClick={save}>
          Enregistrer
        </button>
      </div>

      {isEdit && (
        <div className="btn-row">
          <button className="btn-secondary btn-danger" onClick={del}>
            Supprimer le membre
          </button>
        </div>
      )}
    </div>
  )
}
