import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { MealPlanDrawer } from '../components/MealPlanDrawer'
import { MEAL_SLOTS } from '../types'
import { DAYS_FR, addDays, formatDayMonth, fromISODate, startOfWeek, toISODate, weekDays } from '../lib/dates'
import { recipeStock, recipeIconSlug } from '../lib/recipesLib'
import { productImageSlug, productImageUrl } from '../lib/productImage'

export function PlanningScreen() {
  const { mealPlan, recipes, products, addManyShopping, generateWeekPlan } = useStore()
  const toast = useToast()
  const [weekRef, setWeekRef] = useState(() => startOfWeek(new Date()))
  const [drawer, setDrawer] = useState<{ date: string; slot: string } | null>(null)
  const [planning, setPlanning] = useState(false)

  async function handleGenerateWeek() {
    if (planning) return
    setPlanning(true)
    toast('Claude prépare ta semaine…')
    try {
      const n = await generateWeekPlan(days)
      toast(n > 0 ? `${n} repas planifiés` : 'Aucun repas généré')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Génération impossible')
    } finally {
      setPlanning(false)
    }
  }

  const days = useMemo(() => weekDays(weekRef), [weekRef])
  const todayISO = toISODate(new Date())
  const boardRef = useRef<HTMLDivElement>(null)

  // Le jour actuel (ou le lundi pour une autre semaine) est centré à l'ouverture.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const target = board.querySelector<HTMLElement>('.plan-day.today') ?? board.querySelector<HTMLElement>('.plan-day')
    if (target) board.scrollLeft = target.offsetLeft - (board.clientWidth - target.offsetWidth) / 2
  }, [days])

  function slide(dir: number) {
    const board = boardRef.current
    const card = board?.querySelector<HTMLElement>('.plan-day')
    if (board && card) board.scrollBy({ left: dir * (card.offsetWidth + 14), behavior: 'smooth' })
  }

  // Molette de souris : défilement horizontal du tableau.
  useEffect(() => {
    const board = boardRef.current
    if (!board) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      board.scrollLeft += e.deltaY
      e.preventDefault()
    }
    board.addEventListener('wheel', onWheel, { passive: false })
    return () => board.removeEventListener('wheel', onWheel)
  }, [])
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
      <div className="sticky-zone">
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

      </div>

      <div className="plan-actions">
        <button className="generate-list-btn" onClick={handleGenerateWeek} disabled={planning}>
          <Icon name="sparkles" />
          {planning ? 'Génération du menu…' : (
            <>
              Planifier<span className="plan-long"> ma semaine</span> (IA)
            </>
          )}
        </button>
        <button className="plan-shop-btn" onClick={generateList}>
          <Icon name="cart" />
          <span className="plan-long">Ingrédients manquants vers les courses</span>
          <span className="plan-short">Manquants → courses</span>
        </button>
      </div>

      <div className="week-carousel">
      <button className="carousel-arrow prev" aria-label="Jour précédent" onClick={() => slide(-1)}>
        <Icon name="back" />
      </button>
      <button className="carousel-arrow next" aria-label="Jour suivant" onClick={() => slide(1)}>
        <Icon name="chevron" />
      </button>
      <div className="week-board" ref={boardRef}>
        {days.map((date) => {
          const d = fromISODate(date)
          const isToday = date === todayISO
          const past = date < todayISO
          return (
            <section className={`plan-day${isToday ? ' today' : ''}${past ? ' past' : ''}`} key={date}>
              <header className="plan-day-head">
                <span className="plan-dow">{DAYS_FR[d.getDay()].slice(0, 3)}</span>
                <span className="plan-num">{d.getDate()}</span>
                <span className="plan-month">{formatDayMonth(date).split(' ').slice(1).join(' ')}</span>
                {isToday && <span className="plan-today">Aujourd'hui</span>}
              </header>
              <div className="plan-slots">
                {MEAL_SLOTS.map((slot) => {
                  const meal = mealPlan[`${date}_${slot.id}`]
                  const recipe = meal ? recipes.find((r) => r.title.toLowerCase() === meal.toLowerCase()) : undefined
                  const slug = recipe ? recipeIconSlug(recipe) : meal ? productImageSlug(meal) : null
                  const missing = recipe ? recipeStock(recipe, products).missingIngredients.length : 0
                  return (
                    <button
                      type="button"
                      className={`plan-meal${meal ? ' filled' : ''}`}
                      key={slot.id}
                      onClick={() => setDrawer({ date, slot: slot.id })}
                    >
                      <span className="plan-slot-label">{slot.label}</span>
                      {meal ? (
                        <>
                          <span className="plan-meal-icon">
                            {slug ? <img src={productImageUrl(slug)} alt="" loading="lazy" /> : <Icon name="book" />}
                          </span>
                          <span className="plan-meal-name">{meal}</span>
                          {missing > 0 && <span className="plan-missing">{missing} manquant{missing > 1 ? 's' : ''}</span>}
                        </>
                      ) : (
                        <span className="plan-empty">
                          <Icon name="plus" />
                          Ajouter
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      </div>

      {drawer && (
        <MealPlanDrawer date={drawer.date} slot={drawer.slot} onClose={() => setDrawer(null)} />
      )}
    </div>
  )
}
