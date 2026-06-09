import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import type { Recipe, RecipeIngredient } from '../types'

interface RecipeFormScreenProps {
  /** Recette à modifier, ou null pour une création. */
  recipe?: Recipe | null
  onClose: () => void
  onSaved: (recipe: Recipe) => void
}

const COURSES: [string, string][] = [
  ['plat principal', 'Plat'],
  ['entrée', 'Entrée'],
  ['apéritif', 'Apéro'],
  ['soupe', 'Soupe'],
  ['dessert', 'Dessert'],
]
const COURSE_VALUES = COURSES.map(([v]) => v)

export function RecipeFormScreen({ recipe, onClose, onSaved }: RecipeFormScreenProps) {
  const { addRecipe, updateRecipe, products, recipes, shopCatalog } = useStore()
  const toast = useToast()
  const isEdit = !!recipe

  // Ingrédients déjà connus : stock + autres recettes + catalogue de courses.
  const knownIngredients = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) if (p.name.trim()) map.set(p.name.trim().toLowerCase(), p.name.trim())
    for (const r of recipes)
      for (const ing of r.ingredients)
        if (ing.name?.trim()) map.set(ing.name.trim().toLowerCase(), ing.name.trim())
    for (const e of shopCatalog) if (e.name?.trim()) map.set(e.name.trim().toLowerCase(), e.name.trim())
    return [...map.values()].sort((a, b) => a.localeCompare(b))
  }, [products, recipes, shopCatalog])

  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const [title, setTitle] = useState(recipe?.title ?? '')
  const [course, setCourse] = useState(
    recipe?.tags.find((t) => COURSE_VALUES.includes(t)) ?? 'plat principal',
  )
  const [timeMin, setTimeMin] = useState(recipe?.timeMin ? String(recipe.timeMin) : '')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients.length ? recipe.ingredients : [{ name: '', qty: '' }],
  )
  const [steps, setSteps] = useState((recipe?.steps ?? []).join('\n'))
  const [busy, setBusy] = useState(false)

  function setIng(i: number, p: Partial<RecipeIngredient>) {
    setIngredients((l) => l.map((ing, idx) => (idx === i ? { ...ing, ...p } : ing)))
  }

  async function save() {
    const t = title.trim()
    if (!t) return
    setBusy(true)
    try {
      // Conserve les tags existants hors « type », et applique le type choisi.
      const baseTags = (recipe?.tags ?? ['perso']).filter((tag) => !COURSE_VALUES.includes(tag))
      const tags = [...new Set([...baseTags, 'perso', course])]
      const input = {
        title: t,
        timeMin: Number(timeMin) || 0,
        cuisine: recipe?.cuisine,
        tags,
        favorite: recipe?.favorite ?? false,
        ingredients: ingredients
          .map((i) => ({ name: i.name.trim(), qty: i.qty?.trim() || undefined }))
          .filter((i) => i.name),
        steps: steps.split('\n').map((s) => s.trim()).filter(Boolean),
      }
      if (isEdit && recipe) {
        await updateRecipe(recipe.id, input)
        toast('Recette modifiée')
        onSaved({ ...recipe, ...input })
      } else {
        const created = await addRecipe(input)
        toast('Recette créée')
        onSaved(created)
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title={isEdit ? 'Modifier la recette' : 'Nouvelle recette'} onBack={onClose} />

      <div className="form-section">
        <label className="form-label" htmlFor="rtitle">Nom de la recette</label>
        <input
          id="rtitle"
          className="form-input"
          placeholder="Ex : Gratin de courgettes"
          value={title}
          autoFocus={!isEdit}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="form-section">
        <label className="form-label">Type</label>
        <div className="opt-grid">
          {COURSES.map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={`opt-btn${course === val ? ' active' : ''}`}
              onClick={() => setCourse(val)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="rtime">Temps de préparation (min, optionnel)</label>
        <input
          id="rtime"
          type="number"
          inputMode="numeric"
          className="form-input"
          placeholder="Ex : 30"
          value={timeMin}
          onChange={(e) => setTimeMin(e.target.value)}
        />
      </div>

      <div className="form-section">
        <label className="form-label">Ingrédients</label>
        {ingredients.map((ing, i) => {
          const q = ing.name.trim().toLowerCase()
          const sugg =
            activeIdx === i && q
              ? knownIngredients.filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q).slice(0, 6)
              : []
          return (
            <div key={i}>
              <div className="ing-row">
                <input
                  className="form-input"
                  placeholder="Ingrédient"
                  value={ing.name}
                  onFocus={() => setActiveIdx(i)}
                  onChange={(e) => {
                    setIng(i, { name: e.target.value })
                    setActiveIdx(i)
                  }}
                />
                <input
                  className="form-input ing-qty"
                  placeholder="Qté"
                  value={ing.qty ?? ''}
                  onFocus={() => setActiveIdx(null)}
                  onChange={(e) => setIng(i, { qty: e.target.value })}
                />
                <button
                  className="ing-del"
                  onClick={() => setIngredients((l) => (l.length > 1 ? l.filter((_, idx) => idx !== i) : l))}
                  aria-label="Retirer"
                >
                  <Icon name="trash" width={2} />
                </button>
              </div>
              {sugg.length > 0 && (
                <div className="suggest-list" style={{ padding: 0, margin: '4px 0 8px' }}>
                  {sugg.map((n) => (
                    <button
                      key={n}
                      className="suggest-row"
                      onClick={() => {
                        setIng(i, { name: n })
                        setActiveIdx(null)
                      }}
                    >
                      <Icon name="plus" width={2} />
                      <span className="suggest-name">{n}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <button className="ing-add" onClick={() => setIngredients((l) => [...l, { name: '', qty: '' }])}>
          <Icon name="plus" width={2.2} />
          Ajouter un ingrédient
        </button>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="rsteps">Étapes (optionnel, une par ligne)</label>
        <textarea
          id="rsteps"
          className="form-input"
          style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
          placeholder={'Préchauffer le four à 200°C\nCouper les courgettes\n…'}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
      </div>

      <div className="btn-row" style={{ margin: '0 20px 20px' }}>
        <button className="btn-secondary" onClick={onClose} disabled={busy}>Annuler</button>
        <button className="btn-primary" onClick={save} disabled={busy || !title.trim()}>
          {busy ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la recette'}
        </button>
      </div>
    </div>
  )
}
