import { useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { downscaleImage } from '../lib/imageResize'
import type { Recipe, RecipeIngredient } from '../types'
import { FormFooter } from '../components/FormFooter'
import { linkedProduct } from '../lib/recipesLib'

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
  const { addRecipe, updateRecipe, products, recipes, shopCatalog, scanRecipe } = useStore()
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

  // Produits du stock proposés en premier (liés), puis les noms déjà connus (génériques).
  function productMatches(q: string) {
    if (!q) return []
    const seen = new Set<string>()
    return products
      .filter((p) => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q)
      .filter((p) => (seen.has(p.name.toLowerCase()) ? false : (seen.add(p.name.toLowerCase()), true)))
      .slice(0, 4)
  }

  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [qtyIdx, setQtyIdx] = useState<number | null>(null)
  const QTY_PRESETS = ['QS', 'selon goût', 'une pincée', 'un peu', '1 c. à café', '1 c. à soupe']

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
  const fileRef = useRef<HTMLInputElement>(null)
  const [reading, setReading] = useState(false)

  // Photo(s) d'une recette : Claude la lit et pré-remplit le formulaire (à relire avant d'enregistrer).
  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    if (!files.length) return
    setReading(true)
    try {
      const images = await Promise.all(files.map((f) => downscaleImage(f)))
      const r = await scanRecipe(images)
      if (!r.title && !r.ingredients.length && !r.steps.length) {
        toast('Aucune recette lisible sur la photo')
        return
      }
      if (r.title) setTitle(r.title)
      setCourse(r.course)
      if (r.timeMin) setTimeMin(String(r.timeMin))
      if (r.ingredients.length) setIngredients(r.ingredients.map((i) => ({ name: i.name, qty: i.qty })))
      if (r.steps.length) setSteps(r.steps.join('\n'))
      toast('Recette lue : relis-la avant d’enregistrer')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lecture impossible')
    } finally {
      setReading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
          .map((i) => ({ name: i.name.trim(), qty: i.qty?.trim() || undefined, productId: i.productId }))
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

      <div className="form-group">
      <div className="form-group-title">Recette</div>
      {!isEdit && (
        <div className="form-section recipe-photo">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPhotos} />
          <button type="button" className="ai-complete-btn recipe-photo-btn" disabled={reading} onClick={() => fileRef.current?.click()}>
            <Icon name="scan" width={2.2} />
            {reading ? 'Lecture de la recette…' : 'Photographier une recette'}
          </button>
          <div className="recipe-photo-hint">Livre, carnet ou capture d'écran : jusqu'à 4 photos, tout est pré-rempli.</div>
        </div>
      )}

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
        <div className="opt-grid five">
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
      </div>

      <div className="form-group">
        <div className="form-group-title">Ingrédients</div>
        <div className="form-section">
        {ingredients.map((ing, i) => {
          const q = ing.name.trim().toLowerCase()
          const prodSugg = activeIdx === i ? productMatches(q) : []
          const taken = new Set(prodSugg.map((p) => p.name.toLowerCase()))
          const sugg =
            activeIdx === i && q
              ? knownIngredients
                  .filter((n) => n.toLowerCase().includes(q) && n.toLowerCase() !== q && !taken.has(n.toLowerCase()))
                  .slice(0, 6 - prodSugg.length)
              : []
          const link = ing.name.trim() ? linkedProduct(ing, products) : undefined
          return (
            <div key={i}>
              <div className="ing-row">
                <input
                  className="form-input"
                  placeholder="Ingrédient"
                  value={ing.name}
                  onFocus={() => {
                    setActiveIdx(i)
                    setQtyIdx(null)
                  }}
                  onChange={(e) => {
                    setIng(i, { name: e.target.value, productId: undefined })
                    setActiveIdx(i)
                  }}
                />
                <input
                  className="form-input ing-qty"
                  placeholder="Qté (option.)"
                  value={ing.qty ?? ''}
                  onFocus={() => {
                    setActiveIdx(null)
                    setQtyIdx(i)
                  }}
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
              {ing.name.trim() && (
                <div className={`ing-link ${link ? 'linked' : ''}`}>
                  {link
                    ? `Produit : ${link.brand ? link.brand + ' · ' : ''}${link.name}${link.quantity > 0 ? ` (${link.quantity} en stock)` : ' (épuisé)'}`
                    : 'Générique, sera lié au premier achat'}
                </div>
              )}
              {(prodSugg.length > 0 || sugg.length > 0) && (
                <div className="suggest-list" style={{ padding: 0, margin: '4px 0 8px' }}>
                  {prodSugg.map((p) => (
                    <button
                      key={p.id}
                      className="suggest-row"
                      onClick={() => {
                        setIng(i, { name: p.name, productId: p.id })
                        setActiveIdx(null)
                      }}
                    >
                      <Icon name="check" width={2} />
                      <span className="suggest-name">
                        {p.name}
                        {p.brand ? <span className="ing-sugg-brand"> · {p.brand}</span> : null}
                      </span>
                      <span className="ing-sugg-tag">dans mes produits</span>
                    </button>
                  ))}
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
              {qtyIdx === i && (
                <div className="quick-add-chips" style={{ margin: '4px 0 8px' }}>
                  {QTY_PRESETS.map((p) => (
                    <button key={p} className="quick-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => setIng(i, { qty: p })}>
                      {p}
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
      </div>

      <div className="form-group">
        <div className="form-group-title">Étapes</div>
      <div className="form-section">
        <label className="form-label" htmlFor="rsteps">Une par ligne (optionnel)</label>
        <textarea
          id="rsteps"
          className="form-input"
          style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
          placeholder={'Préchauffer le four à 200°C\nCouper les courgettes\n…'}
          value={steps}
          onChange={(e) => setSteps(e.target.value)}
        />
      </div>
      </div>

      <FormFooter
        onCancel={onClose}
        onSave={save}
        disabled={busy || !title.trim()}
        saveLabel={busy ? 'Enregistrement…' : isEdit ? 'Enregistrer' : 'Créer la recette'}
      />
    </div>
  )
}
