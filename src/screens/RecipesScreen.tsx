import { RecipeIcon } from '../components/RecipeIcon'
import { ClearButton } from '../components/ClearButton'
import { Select } from '../components/Select'
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

type Filter =
  | 'toutes'
  | 'perso'
  | 'favoris'
  | 'plats'
  | 'entrees'
  | 'soupes'
  | 'apero'
  | 'desserts'
  | 'rapides'
  | 'vegetarien'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const FILTERS: [Filter, string][] = [
  ['toutes', 'Toutes'],
  ['perso', 'Perso'],
  ['favoris', 'Favoris'],
  ['plats', 'Plats'],
  ['entrees', 'Entrées'],
  ['soupes', 'Soupes'],
  ['apero', 'Apéro'],
  ['desserts', 'Desserts'],
  ['rapides', 'Rapides'],
  ['vegetarien', 'Végétarien'],
]

export function RecipesScreen({ onOpenRecipe, onOpenFamily }: RecipesScreenProps) {
  const { recipes, products, family, toggleFavorite, generateRecipe } = useStore()
  const toast = useToast()
  const [filter, setFilter] = useState<Filter>('toutes')
  const [generating, setGenerating] = useState(false)
  const [constraint, setConstraint] = useState('')
  const [course, setCourse] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [q, setQ] = useState('')

  async function handleGenerate() {
    if (generating) return
    setGenerating(true)
    toast('Claude cuisine une idée…')
    try {
      const recipe = await generateRecipe({ constraints: constraint || undefined, course: course || undefined })
      onOpenRecipe(recipe)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Génération impossible')
    } finally {
      setGenerating(false)
    }
  }

  const COURSES: [string, string][] = [
    ['', 'Tout type'],
    ['plat principal', 'Plat'],
    ['entrée', 'Entrée'],
    ['apéritif', 'Apéro'],
    ['soupe', 'Soupe'],
    ['dessert', 'Dessert'],
  ]
  const CONSTRAINTS: [string, string][] = [
    ['', 'Au choix'],
    ['anti-gaspillage, utilise surtout les produits qui périment bientôt', 'Anti-gaspi'],
    ['rapide, moins de 20 minutes', 'Rapide'],
    ['végétarien', 'Végétarien'],
    ['sans gluten', 'Sans gluten'],
  ]

  const filtered = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    return recipes.filter((r) => {
      if (words.length) {
        const hay = norm([r.title, r.cuisine ?? '', ...r.tags, ...r.ingredients.map((i) => i.name)].join(' '))
        if (!words.every((w) => hay.includes(w))) return false
      }
      const tags = r.tags.map(norm)
      if (filter === 'perso') return tags.includes('perso')
      if (filter === 'favoris') return r.favorite
      if (filter === 'plats') return tags.some((t) => t.includes('plat'))
      if (filter === 'entrees') return tags.some((t) => t.includes('entree'))
      if (filter === 'soupes') return tags.some((t) => t.includes('soupe'))
      if (filter === 'apero') return tags.some((t) => t.includes('aperitif') || t.includes('apero'))
      if (filter === 'desserts') return tags.some((t) => t.includes('dessert'))
      if (filter === 'rapides') return tags.includes('rapide') || r.timeMin <= 15
      if (filter === 'vegetarien') return tags.includes('vegetarien') || tags.includes('vegetalien')
      return true
    })
  }, [recipes, filter, q])

  return (
    <div className="screen-fade">
      <div className="sticky-zone">
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

      <div className="recipe-search search-row">
        <div className="search-input">
          <Icon name="search" />
          <input
            type="text"
            aria-label="Rechercher une recette"
            placeholder="Recette, ingrédient…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && <ClearButton onClick={() => setQ('')} />}
        </div>
        <Select
          className={`sort-select${filter !== 'toutes' ? ' active' : ''}`}
          ariaLabel="Filtrer les recettes"
          title="Afficher"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={FILTERS.map(([value, label]) => ({ value, label }))}
          renderTrigger={(label) => (
            <>
              <Icon name="sliders" />
              <span className="sort-label">{label}</span>
            </>
          )}
        />
      </div>


      </div>

      <div className="product-list">
        <div className="ai-block">
          {!aiOpen ? (
            <button type="button" className="ai-gen-toggle" onClick={() => setAiOpen(true)}>
              <span className="ai-icon">
                <Icon name="sparkles" />
              </span>
              <span className="ai-text">
                <span className="ai-title">Générer une recette avec l’IA</span>
                <span className="ai-desc">À partir de ton stock</span>
              </span>
              <Icon name="chevron" />
            </button>
          ) : (
            <div className={`ai-gen${generating ? ' busy' : ''}`}>
              <div className="ai-gen-head">
                <div className="ai-icon">
                  <Icon name="sparkles" />
                </div>
                <div className="ai-text">
                  <div className="ai-title">Générer une recette avec l’IA</div>
                  <div className="ai-desc">Créée à partir de ton stock · Claude</div>
                </div>
                <button type="button" className="ai-gen-close" aria-label="Replier" onClick={() => setAiOpen(false)}>
                  <Icon name="close" />
                </button>
              </div>
              <div className="ai-gen-fields">
                <label className="ai-field">
                  <span>Type de plat</span>
                  <Select
                    className="ai-select"
                    ariaLabel="Type de plat"
                    value={course}
                    onChange={setCourse}
                    options={COURSES.map(([val, label]) => ({ value: val, label }))}
                  />
                </label>
                <label className="ai-field">
                  <span>Style</span>
                  <Select
                    className="ai-select"
                    ariaLabel="Style de recette"
                    value={constraint}
                    onChange={setConstraint}
                    options={CONSTRAINTS.map(([val, label]) => ({ value: val, label }))}
                  />
                </label>
                <button className="btn-primary ai-gen-btn" disabled={generating} onClick={handleGenerate}>
                  <Icon name="sparkles" />
                  {generating ? 'Génération en cours…' : 'Générer'}
                </button>
              </div>
            </div>
          )}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <Icon name="book" />
            <p>{q ? `Aucune recette pour « ${q} ».` : 'Aucune recette dans ce filtre.'}</p>
          </div>
        )}

        {filtered.map((recipe) => {
          const stock = recipeStock(recipe, products)
          const adaptations = family
            .map((m) => ({ m, note: adaptationFor(recipe, m) }))
            .filter((x) => x.note)
            .slice(0, 2)
          return (
            <div className="recipe-card" key={recipe.id} onClick={() => onOpenRecipe(recipe)}>
              <div className="recipe-header">
                <RecipeIcon recipe={recipe} />
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
      </div>
    </div>
  )
}
