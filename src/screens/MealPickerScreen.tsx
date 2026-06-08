import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { MEAL_SLOTS } from '../types'
import { DAYS_FR, formatDayMonth, fromISODate } from '../lib/dates'

interface MealPickerScreenProps {
  date: string
  slot: string
  onBack: () => void
}

/**
 * Choix d'un repas pour un créneau : recette favorite, recette existante,
 * ou saisie libre (avec option « sauver en recette perso »).
 */
export function MealPickerScreen({ date, slot, onBack }: MealPickerScreenProps) {
  const { recipes, mealPlan, setMeal, addRecipe } = useStore()
  const toast = useToast()

  const key = `${date}_${slot}`
  const current = mealPlan[key] ?? ''
  const slotLabel = MEAL_SLOTS.find((s) => s.id === slot)?.label ?? slot
  const d = fromISODate(date)

  const [search, setSearch] = useState('')
  const [manual, setManual] = useState('')
  const [saveAsRecipe, setSaveAsRecipe] = useState(false)

  const favorites = useMemo(() => recipes.filter((r) => r.favorite), [recipes])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipes.filter((r) => !q || r.title.toLowerCase().includes(q))
  }, [recipes, search])

  async function pick(title: string) {
    await setMeal(date, slot, title)
    toast(`${slotLabel} : ${title}`)
    onBack()
  }

  async function addManual() {
    const title = manual.trim()
    if (!title) return
    if (saveAsRecipe) {
      await addRecipe({ title, timeMin: 0, tags: ['perso'], favorite: false, ingredients: [] })
      toast('Recette perso enregistrée')
    }
    await setMeal(date, slot, title)
    onBack()
  }

  async function clearMeal() {
    await setMeal(date, slot, null)
    toast('Repas retiré')
    onBack()
  }

  return (
    <div className="screen-fade">
      <PageHeader title={`${slotLabel} · ${DAYS_FR[d.getDay()]} ${formatDayMonth(date)}`} onBack={onBack} />

      {current && (
        <div className="form-section">
          <div className="meal-current">
            <div>
              <div className="meal-current-label">Repas actuel</div>
              <div className="meal-current-title">{current}</div>
            </div>
            <button className="btn-secondary btn-danger" style={{ width: 'auto', padding: '0 14px', height: 38 }} onClick={clearMeal}>
              Retirer
            </button>
          </div>
        </div>
      )}

      {/* Saisie libre */}
      <div className="form-section">
        <label className="form-label" htmlFor="manual">Repas libre</label>
        <div className="form-row">
          <input
            id="manual"
            className="form-input"
            placeholder="Ex : Pâtes bolognaise"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addManual() }}
          />
          <button className="btn-primary" style={{ width: 'auto', padding: '0 18px' }} disabled={!manual.trim()} onClick={addManual}>
            Ajouter
          </button>
        </div>
        <label className="check-row" onClick={() => setSaveAsRecipe((v) => !v)}>
          <span className={`check-box${saveAsRecipe ? ' on' : ''}`}>
            {saveAsRecipe && <Icon name="check" width={3} />}
          </span>
          Sauver aussi en recette perso
        </label>
      </div>

      {/* Favoris */}
      {favorites.length > 0 && (
        <div className="form-section">
          <label className="form-label">Favoris</label>
          <div className="quick-add-chips">
            {favorites.map((r) => (
              <button key={r.id} className="quick-chip" onClick={() => pick(r.title)}>
                <Icon name="heart" width={2.4} />
                {r.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toutes les recettes */}
      <div className="form-section">
        <label className="form-label">Mes recettes</label>
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
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune recette.</p>
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
      </div>
    </div>
  )
}
