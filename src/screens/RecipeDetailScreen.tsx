import { MemberAvatar } from '../components/MemberAvatar'
import { useConfirm } from '../components/Confirm'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { ShareLinkSheet } from '../components/ShareLinkSheet'
import { useState } from 'react'
import { linkedProduct, recipeStock, adaptationFor, scaleQty } from '../lib/recipesLib'
import type { Recipe } from '../types'

interface RecipeDetailScreenProps {
  recipe: Recipe
  onBack: () => void
  onGoShopping: () => void
  onEdit: (recipe: Recipe) => void
}

export function RecipeDetailScreen({ recipe, onBack, onGoShopping, onEdit }: RecipeDetailScreenProps) {
  const { products, family, addManyShopping, prepareRecipe, removeRecipe, shareRecipe } = useStore()
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const base = recipe.servings ?? 0
  const [people, setPeople] = useState(base || 4)
  const unit = recipe.servingsUnit?.trim() || 'personnes'
  const unitLabel = unit === 'personnes' && people <= 1 ? 'personne' : unit
  const step = base >= 20 ? 5 : 1

  async function handleShare() {
    if (sharing) return
    setSharing(true)
    try {
      const token = await shareRecipe(recipe)
      const url = `${location.origin}/?r=${token}`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: recipe.title, text: `Une recette Miamm à découvrir : ${recipe.title}`, url })
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return
        }
      }
      setShareUrl(url)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Partage impossible')
    } finally {
      setSharing(false)
    }
  }
  const toast = useToast()
  const askConfirm = useConfirm()

  async function handleDelete() {
    if (!(await askConfirm({ title: `Supprimer la recette « ${recipe.title} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true }))) return
    await removeRecipe(recipe.id)
    toast('Recette supprimée')
    onBack()
  }

  const adaptations = family.map((m) => ({ m, note: adaptationFor(recipe, m) }))

  async function addMissing() {
    const missing = recipeStock(recipe, products).missingIngredients
    if (missing.length === 0) {
      toast('Tous les ingrédients sont en stock')
      return
    }
    const n = await addManyShopping(
      missing.map((i) => ({ name: i.name, category: 'autre' as const, quantity: 1, source: 'auto' as const })),
    )
    toast(`${n} ingrédient${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} aux courses`)
    onGoShopping()
  }

  async function prepared() {
    await prepareRecipe(recipe)
    toast('Stock mis à jour')
    onBack()
  }

  return (
    <div className="screen-fade">
      <PageHeader
        title="Recette"
        onBack={onBack}
        action={
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon-btn" onClick={handleShare} disabled={sharing} aria-label="Partager la recette">
              <Icon name="share" />
            </button>
            <button className="icon-btn" onClick={() => onEdit(recipe)} aria-label="Modifier">
              <Icon name="pencil" />
            </button>
          </div>
        }
      />

      <div className="form-section" style={{ textAlign: 'center', paddingTop: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{recipe.title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {[
            recipe.timeMin ? `${recipe.timeMin} min` : '',
            recipe.cuisine ?? '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {base > 0 && (
        <div className="servings-stepper">
          <span>Pour</span>
          <button type="button" className="icon-btn" onClick={() => setPeople((n) => Math.max(1, n - step))} aria-label="Moins de personnes" disabled={people <= 1}>
            <Icon name="minus" width={2.4} />
          </button>
          <input
            className="servings-input"
            type="number"
            inputMode="numeric"
            min={1}
            value={people}
            aria-label="Quantité souhaitée"
            onChange={(e) => {
              const v = Math.round(Number(e.target.value))
              if (v >= 1) setPeople(Math.min(999, v))
            }}
          />
          <button type="button" className="icon-btn" onClick={() => setPeople((n) => Math.min(999, n + step))} aria-label="Plus de personnes">
            <Icon name="plus" width={2.4} />
          </button>
          <span>{unitLabel}</span>
          {people !== base && (
            <button type="button" className="servings-reset" onClick={() => setPeople(base)}>
              Initial : {base}
            </button>
          )}
        </div>
      )}

      <div className="form-section">
        <label className="form-label">Ingrédients</label>
        <div className="ingredient-list">
          {recipe.ingredients.map((ing, i) => {
            const prod = linkedProduct(ing, products)
            const inStock = !!prod && prod.quantity > 0
            return (
              <div className="ingredient-item" key={i}>
                <span className={`ingredient-status ${inStock ? 'in-stock' : 'missing'}`} />
                <span className="ingredient-main">
                  <span>{ing.name}</span>
                  <span className="ingredient-sub">
                    {prod
                      ? `${prod.brand ? prod.brand + ' · ' : ''}${inStock ? prod.quantity + ' en stock' : 'épuisé'}`
                      : 'Pas encore acheté'}
                  </span>
                </span>
                {ing.qty && <span className="ingredient-qty">{base > 0 ? scaleQty(ing.qty, base, people) : ing.qty}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {recipe.steps && recipe.steps.length > 0 && (
        <div className="form-section">
          <label className="form-label">Préparation</label>
          <div className="ingredient-list">
            {recipe.steps.map((step, i) => (
              <div className="ingredient-item" key={i}>
                <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{i + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shareUrl && <ShareLinkSheet title={recipe.title} url={shareUrl} onClose={() => setShareUrl(null)} />}

      {recipe.notes && (
        <div className="form-section">
          <label className="form-label">Notes</label>
          <div className="recipe-notes">{recipe.notes}</div>
        </div>
      )}

      {adaptations.length > 0 && (
        <div className="form-section">
          <label className="form-label">Adaptations famille</label>
          {adaptations.map(({ m, note }) => (
            <div className="adaptation-card" key={m.id}>
              <div className="adaptation-member">
                <MemberAvatar member={m} />
                <span>{m.name}</span>
              </div>
              <p className="adaptation-note">{note ?? 'Aucune adaptation nécessaire'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="form-footer">
        <div className="form-actions">
          <button type="button" className="action-chip" onClick={addMissing} aria-label="Ajouter les manquants aux courses" title="Ajouter les manquants aux courses">
            <Icon name="cart" width={2} />
          </button>
          <button type="button" className="action-chip danger" onClick={handleDelete} aria-label="Supprimer la recette" title="Supprimer la recette">
            <Icon name="trash" width={2} />
          </button>
        </div>
        <button className="btn-primary form-save" onClick={prepared}>
          <Icon name="check" width={2.4} />
          Recette préparée
        </button>
      </div>
    </div>
  )
}
