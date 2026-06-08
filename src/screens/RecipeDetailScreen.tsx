import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { isIngredientInStock, recipeStock, adaptationFor } from '../lib/recipesLib'
import type { Recipe } from '../types'

interface RecipeDetailScreenProps {
  recipe: Recipe
  onBack: () => void
  onGoShopping: () => void
}

export function RecipeDetailScreen({ recipe, onBack, onGoShopping }: RecipeDetailScreenProps) {
  const { products, family, addManyShopping, prepareRecipe } = useStore()
  const toast = useToast()

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
      <PageHeader title="Recette" onBack={onBack} />

      <div className="form-section" style={{ textAlign: 'center', paddingTop: 10 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{recipe.title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          {recipe.timeMin} min{recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
        </p>
      </div>

      <div className="form-section">
        <label className="form-label">Ingrédients</label>
        <div className="ingredient-list">
          {recipe.ingredients.map((ing, i) => {
            const inStock = isIngredientInStock(ing, products)
            return (
              <div className="ingredient-item" key={i}>
                <span className={`ingredient-status ${inStock ? 'in-stock' : 'missing'}`} />
                <span>{ing.name}</span>
                {ing.qty && <span className="ingredient-qty">{ing.qty}</span>}
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

      {adaptations.length > 0 && (
        <div className="form-section">
          <label className="form-label">Adaptations famille</label>
          {adaptations.map(({ m, note }) => (
            <div className="adaptation-card" key={m.id}>
              <div className="adaptation-member">
                <div className="member-avatar" style={{ background: m.color }}>
                  {m.name.charAt(0)}
                </div>
                <span>{m.name}</span>
              </div>
              <p className="adaptation-note">{note ?? 'Aucune adaptation nécessaire'}</p>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button className="btn-secondary" onClick={addMissing}>
          Ajouter manquants
        </button>
        <button className="btn-primary" onClick={prepared}>
          Recette préparée
        </button>
      </div>
    </div>
  )
}
