import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { FormFooter } from '../components/FormFooter'
import type { Recipe, RecipeInput } from '../types'

/** Aperçu d'une recette reçue par lien, avec ajout dans son propre foyer. */
export function SharedRecipeScreen({
  token,
  onBack,
  onAdded,
}: {
  token: string
  onBack: () => void
  onAdded: (recipe: Recipe) => void
}) {
  const { getSharedRecipe, addRecipe } = useStore()
  const toast = useToast()
  const [recipe, setRecipe] = useState<RecipeInput | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getSharedRecipe(token)
      .then((r) => alive && setRecipe(r))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Lien invalide'))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function add() {
    if (!recipe) return
    setBusy(true)
    try {
      const created = await addRecipe({
        ...recipe,
        tags: [...new Set([...recipe.tags, 'perso'])],
        favorite: false,
      })
      toast('Recette ajoutée à tes recettes')
      onAdded(created)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ajout impossible')
    } finally {
      setBusy(false)
    }
  }

  const meta = recipe
    ? [recipe.timeMin ? `${recipe.timeMin} min` : '', recipe.servings ? `${recipe.servings} ${recipe.servingsUnit || "pers."}` : '']
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="screen-fade">
      <PageHeader title="Recette reçue" onBack={onBack} />
      {error && <div className="form-section"><p style={{ color: 'var(--muted)', textAlign: 'center' }}>{error}</p></div>}
      {!error && !recipe && <div className="form-section"><div className="splash-spin" style={{ margin: '40px auto' }} /></div>}
      {recipe && (
        <>
          <div className="form-section" style={{ textAlign: 'center', paddingTop: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{recipe.title}</h2>
            {meta && <p style={{ color: 'var(--muted)', fontSize: 14 }}>{meta}</p>}
          </div>
          <div className="form-section">
            <label className="form-label">Ingrédients</label>
            <div className="ingredient-list">
              {recipe.ingredients.map((ing, i) => (
                <div className="ingredient-item" key={i}>
                  <span>
                    {ing.qty ? `${ing.qty} ` : ''}
                    {ing.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {recipe.steps && recipe.steps.length > 0 && (
            <div className="form-section">
              <label className="form-label">Préparation</label>
              <div className="ingredient-list">
                {recipe.steps.map((s, i) => (
                  <div className="ingredient-item" key={i}>
                    <span style={{ fontWeight: 700, color: 'var(--muted)' }}>{i + 1}.</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {recipe.notes && (
            <div className="form-section">
              <label className="form-label">Notes</label>
              <div className="recipe-notes">{recipe.notes}</div>
            </div>
          )}
          <FormFooter onCancel={onBack} onSave={add} disabled={busy} saveLabel={busy ? 'Ajout…' : 'Ajouter à mes recettes'} />
        </>
      )}
    </div>
  )
}
