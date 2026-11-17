import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { findDuplicates, groupKey, type DupGroup } from '../lib/duplicates'

const IGNORE_KEY = 'miamm.dup.ignored'
function loadIgnored(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

/** Harmonise les noms d'un même produit (« Lait », « Lait Boni 1L »…) pour que tout se rapproche. */
export function DuplicatesScreen({ onBack }: { onBack: () => void }) {
  const { products, updateProduct } = useStore()
  const toast = useToast()
  const [ignored, setIgnored] = useState<Set<string>>(loadIgnored)
  const groups = useMemo(() => findDuplicates(products, ignored), [products, ignored])

  function ignore(g: DupGroup) {
    const next = new Set(ignored).add(groupKey(g))
    setIgnored(next)
    try {
      localStorage.setItem(IGNORE_KEY, JSON.stringify([...next]))
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Noms en double" onBack={onBack} />
      <p className="dup-intro">
        Un même produit enregistré sous plusieurs noms fausse le comparatif de prix, les recettes et le regroupement des
        identiques. Choisis le nom à garder : tous les lots prennent ce nom (marque, contenance et dates ne changent pas).
      </p>
      {groups.length === 0 ? (
        <div className="empty-state">
          <p>Aucun doublon de nom trouvé. Tout est propre.</p>
        </div>
      ) : (
        <div className="dup-list">
          {groups.map((g) => (
            <DupCard
              key={groupKey(g)}
              group={g}
              onIgnore={() => ignore(g)}
              onMerge={async (target) => {
                const ids = products.filter((p) => g.names.some((n) => n.name === p.name.trim()) && p.name !== target)
                for (const p of ids) await updateProduct(p.id, { name: target })
                toast(`${ids.length} produit${ids.length > 1 ? 's' : ''} renommé${ids.length > 1 ? 's' : ''} en « ${target} »`)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DupCard({ group, onIgnore, onMerge }: { group: DupGroup; onIgnore: () => void; onMerge: (target: string) => void }) {
  const [target, setTarget] = useState(group.suggested)
  return (
    <div className="dup-card">
      <div className="dup-badge">{group.strong ? 'Très probable' : 'À vérifier'}</div>
      {group.names.map((n) => (
        <label key={n.name} className="dup-row">
          <input type="radio" name={`dup-${group.suggested}`} checked={target === n.name} onChange={() => setTarget(n.name)} />
          <span className="dup-name">{n.name}</span>
          <span className="dup-count">
            {n.count} lot{n.count > 1 ? 's' : ''}
          </span>
        </label>
      ))}
      <div className="dup-actions">
        <button className="btn-secondary" onClick={onIgnore}>
          Ce ne sont pas les mêmes
        </button>
        <button className="btn-primary" onClick={() => onMerge(target)}>
          Tout appeler « {target} »
        </button>
      </div>
    </div>
  )
}
