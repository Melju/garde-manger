import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from './Toast'
import { Icon } from './Icon'
import { MEAL_SLOTS, type RecipeIngredient } from '../types'
import { DAYS_FR, formatDayMonth, fromISODate } from '../lib/dates'

interface MealPlanDrawerProps {
  date: string
  slot: string
  onClose: () => void
}

/** Drawer (feuille du bas) pour planifier un repas sur un créneau. */
export function MealPlanDrawer({ date, slot, onClose }: MealPlanDrawerProps) {
  const { recipes, mealPlan, setMeal, addRecipe } = useStore()
  const toast = useToast()

  const key = `${date}_${slot}`
  const current = mealPlan[key] ?? ''
  const slotLabel = MEAL_SLOTS.find((s) => s.id === slot)?.label ?? slot
  const d = fromISODate(date)

  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'pick' | 'custom'>('pick')
  // Repas personnalisé
  const [title, setTitle] = useState('')
  const [course, setCourse] = useState('plat principal')
  const [saveAsRecipe, setSaveAsRecipe] = useState(true)
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ name: '', qty: '' }])

  const COURSES: [string, string][] = [
    ['plat principal', 'Plat'],
    ['entrée', 'Entrée'],
    ['apéritif', 'Apéro'],
    ['soupe', 'Soupe'],
    ['dessert', 'Dessert'],
  ]

  const favorites = useMemo(() => recipes.filter((r) => r.favorite), [recipes])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipes.filter((r) => !q || r.title.toLowerCase().includes(q))
  }, [recipes, search])

  async function pick(t: string) {
    await setMeal(date, slot, t)
    toast(`${slotLabel} : ${t}`)
    onClose()
  }

  async function clearMeal() {
    await setMeal(date, slot, null)
    toast('Repas retiré')
    onClose()
  }

  function setIng(i: number, patch: Partial<RecipeIngredient>) {
    setIngredients((list) => list.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)))
  }
  function addIngRow() {
    setIngredients((list) => [...list, { name: '', qty: '' }])
  }
  function removeIngRow(i: number) {
    setIngredients((list) => (list.length > 1 ? list.filter((_, idx) => idx !== i) : list))
  }

  async function saveCustom() {
    const t = title.trim()
    if (!t) return
    const cleanIngredients = ingredients
      .map((ing) => ({ name: ing.name.trim(), qty: ing.qty?.trim() || undefined }))
      .filter((ing) => ing.name)
    if (saveAsRecipe) {
      await addRecipe({
        title: t,
        timeMin: 0,
        tags: ['perso', course],
        favorite: false,
        ingredients: cleanIngredients,
      })
      toast('Recette créée et planifiée')
    } else {
      toast(`${slotLabel} : ${t}`)
    }
    await setMeal(date, slot, t)
    onClose()
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-handle" />
        <div className="drawer-head">
          <div>
            <div className="drawer-title">Planifier — {slotLabel}</div>
            <div className="drawer-sub">{DAYS_FR[d.getDay()]} {formatDayMonth(date)}</div>
          </div>
          {current && (
            <button className="btn-secondary btn-danger" style={{ width: 'auto', padding: '0 14px', height: 36 }} onClick={clearMeal}>
              Retirer
            </button>
          )}
        </div>

        <div className="seg">
          <button className={`seg-btn${mode === 'pick' ? ' active' : ''}`} onClick={() => setMode('pick')}>
            Une recette
          </button>
          <button className={`seg-btn${mode === 'custom' ? ' active' : ''}`} onClick={() => setMode('custom')}>
            Repas personnalisé
          </button>
        </div>

        <div className="drawer-body">
          {mode === 'pick' ? (
            <>
              {favorites.length > 0 && !search.trim() && (
                <>
                  <div className="form-label">Favoris</div>
                  <div className="quick-add-chips" style={{ marginBottom: 14 }}>
                    {favorites.map((r) => (
                      <button key={r.id} className="quick-chip" onClick={() => pick(r.title)}>
                        <Icon name="heart" width={2.4} />
                        {r.title}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="search-input" style={{ marginBottom: 12 }}>
                <Icon name="search" />
                <input
                  type="text"
                  placeholder="Rechercher une recette…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {filtered.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                  Aucune recette. Crée un repas personnalisé.
                </p>
              ) : (
                <div className="suggest-list" style={{ padding: 0 }}>
                  {filtered.map((r) => (
                    <button key={r.id} className="suggest-row" onClick={() => pick(r.title)}>
                      {r.favorite ? <Icon name="heart" width={2} /> : <Icon name="book" width={2} />}
                      <span className="suggest-name">{r.title}</span>
                      {r.timeMin > 0 && <span className="suggest-cat">{r.timeMin} min</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <label className="form-label" htmlFor="ctitle">Nom du repas</label>
              <input
                id="ctitle"
                className="form-input"
                placeholder="Ex : Curry de légumes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              {saveAsRecipe && (
                <>
                  <label className="form-label">Type</label>
                  <div className="opt-grid" style={{ marginBottom: 12 }}>
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
                </>
              )}

              <label className="check-row" onClick={() => setSaveAsRecipe((v) => !v)}>
                <span className={`check-box${saveAsRecipe ? ' on' : ''}`}>
                  {saveAsRecipe && <Icon name="check" width={3} />}
                </span>
                Sauver en recette perso (avec ingrédients)
              </label>

              {saveAsRecipe && (
                <div style={{ marginTop: 14 }}>
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
                      <button className="ing-del" onClick={() => removeIngRow(i)} aria-label="Retirer">
                        <Icon name="trash" width={2} />
                      </button>
                    </div>
                  ))}
                  <button className="ing-add" onClick={addIngRow}>
                    <Icon name="plus" width={2.2} />
                    Ajouter un ingrédient
                  </button>
                </div>
              )}

              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                disabled={!title.trim()}
                onClick={saveCustom}
              >
                {saveAsRecipe ? 'Créer la recette et planifier' : 'Ajouter au planning'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
