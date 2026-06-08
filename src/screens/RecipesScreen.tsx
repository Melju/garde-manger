import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { recipeStock, adaptationFor } from '../lib/recipesLib'
import type { Recipe } from '../types'

interface RecipesScreenProps {
  onOpenRecipe: (recipe: Recipe) => void
  onOpenFamily: () => void
}

type Filter = 'toutes' | 'perso' | 'favoris' | 'rapides' | 'vegetarien'

export function RecipesScreen({ onOpenRecipe, onOpenFamily }: RecipesScreenProps) {
  const { recipes, products, family, toggleFavorite } = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('toutes')

  const filtered = useMemo(() => {
    return recipes.filter((r) => {
      if (filter === 'perso') return r.tags.includes('perso')
      if (filter === 'favoris') return r.favorite
      if (filter === 'rapides') return r.tags.includes('rapide') || r.timeMin <= 15
      if (filter === 'vegetarien') return r.tags.includes('vegetarien') || r.tags.includes('vegetalien')
      return true
    })
  }, [recipes, filter])

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Recettes</h1>
          <p>Suggestions avec ton stock</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={onOpenFamily} aria-label="Famille">
            <Icon name="users" />
          </button>
        </div>
      </header>

      <div className="filter-tabs">
        {([
          ['toutes', 'Toutes'],
          ['perso', 'Perso'],
          ['favoris', 'Favoris'],
          ['rapides', 'Rapides'],
          ['vegetarien', 'Végétarien'],
        ] as [Filter, string][]).map(([id, label]) => (
          <button
            key={id}
            className={`filter-tab${filter === id ? ' active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="product-list">
        {filtered.map((recipe) => {
          const stock = recipeStock(recipe, products)
          const adaptations = family
            .map((m) => ({ m, note: adaptationFor(recipe, m) }))
            .filter((x) => x.note)
            .slice(0, 2)
          return (
            <div className="recipe-card" key={recipe.id} onClick={() => onOpenRecipe(recipe)}>
              <div className="recipe-header">
                <div className="recipe-info">
                  <div className="recipe-title">{recipe.title}</div>
                  <div className="recipe-meta">
                    {recipe.timeMin} min{recipe.cuisine ? ` · ${recipe.cuisine}` : ''}
                  </div>
                </div>
                <button
                  className={`fav-btn${recipe.favorite ? ' active' : ''}`}
                  aria-label="Favori"
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(recipe.id)
                  }}
                >
                  <Icon name="heart" />
                </button>
              </div>
              <div className="recipe-tags">
                {stock.missing === 0 ? (
                  <span className="recipe-tag available">Tous en stock</span>
                ) : (
                  <>
                    <span className="recipe-tag available">{stock.inStock} ingr. en stock</span>
                    <span className="recipe-tag">{stock.missing} manquant{stock.missing > 1 ? 's' : ''}</span>
                  </>
                )}
              </div>
              {adaptations.length > 0 && (
                <div className="recipe-adaptations">
                  {adaptations.map(({ m, note }) => (
                    <span className="adaptation" key={m.id}>
                      {m.name} → {note}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <div className="ai-suggest-card" onClick={() => toast('Suggestion IA bientôt disponible')}>
          <div className="ai-icon">
            <Icon name="sparkles" />
          </div>
          <div>
            <div className="ai-title">Génère une recette créative</div>
            <div className="ai-desc">Basée sur tes ingrédients disponibles</div>
          </div>
        </div>
      </div>
    </div>
  )
}
