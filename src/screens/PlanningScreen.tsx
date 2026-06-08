import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { MEAL_SLOTS } from '../types'
import { DAYS_FR, addDays, formatDayMonth, fromISODate, startOfWeek, toISODate, weekDays } from '../lib/dates'
import { recipeStock } from '../lib/recipesLib'

interface PlanningScreenProps {
  onEditMeal: (date: string, slot: string) => void
}

export function PlanningScreen({ onEditMeal }: PlanningScreenProps) {
  const { mealPlan, recipes, products, addManyShopping } = useStore()
  const toast = useToast()
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date()))

  const days = useMemo(() => weekDays(weekRef), [weekRef])
  const todayISO = toISODate(new Date())
  const label = `Semaine du ${formatDayMonth(days[0])}`

  async function generateList() {
    // Recettes planifiées cette semaine → ingrédients manquants → liste de courses.
    const planned = new Set<string>()
    for (const d of days) {
      for (const s of MEAL_SLOTS) {
        const v = mealPlan[`${d}_${s.id}`]
        if (v) planned.add(v.toLowerCase())
      }
    }
    const missing = new Map<string, string>()
    for (const recipe of recipes) {
      if (!planned.has(recipe.title.toLowerCase())) continue
      for (const ing of recipeStock(recipe, products).missingIngredients) {
        missing.set(ing.name.toLowerCase(), ing.name)
      }
    }
    if (missing.size === 0) {
      toast('Aucun ingrédient manquant à ajouter')
      return
    }
    const n = await addManyShopping(
      [...missing.values()].map((name) => ({ name, category: 'autre' as const, quantity: 1, source: 'auto' as const })),
    )
    toast(`${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} aux courses`)
  }

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Planning des repas</h1>
          <p>Organise ta semaine</p>
        </div>
      </header>

      <div className="week-nav">
        <button onClick={() => setWeekRef((d) => addDays(d, -7))} aria-label="Semaine précédente">
          <Icon name="back" />
        </button>
        <span>{label}</span>
        <button onClick={() => setWeekRef((d) => addDays(d, 7))} aria-label="Semaine suivante">
          <Icon name="chevron" />
        </button>
      </div>

      {days.map((date) => {
        const d = fromISODate(date)
        return (
          <div className={`day-card${date === todayISO ? ' today' : ''}`} key={date}>
            <div className="day-header">
              <span className="day-name">{DAYS_FR[d.getDay()]}</span>
              <span className="day-date">{formatDayMonth(date)}</span>
            </div>
            <div className="day-meals">
              {MEAL_SLOTS.map((slot) => {
                const meal = mealPlan[`${date}_${slot.id}`]
                return (
                  <div className="meal-slot" key={slot.id}>
                    <span className="meal-type">{slot.label}</span>
                    <span className={`meal-content${meal ? '' : ' empty'}`}>
                      {meal ?? 'Ajouter un repas'}
                    </span>
                    <button className="meal-add" onClick={() => onEditMeal(date, slot.id)} aria-label="Modifier">
                      <Icon name={meal ? 'pencil' : 'plus'} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="btn-row" style={{ marginTop: 20 }}>
        <button className="btn-primary" onClick={generateList}>
          Générer la liste de courses
        </button>
      </div>
    </div>
  )
}
