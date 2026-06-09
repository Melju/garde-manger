import { useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import type { Recipe, RecipeIngredient } from '../types'

interface RecipeFormScreenProps {
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

export function RecipeFormScreen({ onClose, onSaved }: RecipeFormScreenProps) {
  const { addRecipe } = useStore()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('plat principal')
  const [timeMin, setTimeMin] = useState('')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ name: '', qty: '' }])
  const [steps, setSteps] = useState('')
  const [busy, setBusy] = useState(false)

  function setIng(i: number, p: Partial<RecipeIngredient>) {
    setIngredients((l) => l.map((ing, idx) => (idx === i ? { ...ing, ...p } : ing)))
  }

  async function save() {
    const t = title.trim()
    if (!t) return
    setBusy(true)
    try {
      const recipe = await addRecipe({
        title: t,
        timeMin: Number(timeMin) || 0,
        tags: ['perso', course],
        favorite: false,
        ingredients: ingredients
          .map((i) => ({ name: i.name.trim(), qty: i.qty?.trim() || undefined }))
          .filter((i) => i.name),
        steps: steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      })
      toast('Recette créée')
      onSaved(recipe)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Nouvelle recette" onBack={onClose} />

      <div className="form-section">
        <label className="form-label" htmlFor="rtitle">Nom de la recette</label>
        <input
          id="rtitle"
          className="form-input"
          placeholder="Ex : Gratin de courgettes"
          value={title}
          autoFocus
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
        {ingredients.map((ing, i) => (
          <div className="ing-row" key={i}>
            <input
              className="form-input"
              placeholder="Ingrédient"
              value={ing.name}
              onChange={(e) => setIng(i, { name: e.target.value })}
            />
            <input
              className="form-input ing-qty"
              placeholder="Qté"
              value={ing.qty ?? ''}
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
        ))}
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
          {busy ? 'Création…' : 'Créer la recette'}
        </button>
      </div>
    </div>
  )
}
