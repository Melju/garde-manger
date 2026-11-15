import { recipeIconSlug } from '../lib/recipesLib'
import { productImageUrl } from '../lib/productImage'
import { Icon } from './Icon'
import type { Recipe } from '../types'

/** Pastille d'illustration d'une recette (icône du plat ou d'un ingrédient, sinon livre). */
export function RecipeIcon({ recipe, size = 56 }: { recipe: Recipe; size?: number }) {
  const slug = recipeIconSlug(recipe)
  return (
    <div className="recipe-icon" style={{ width: size, height: size }} aria-hidden>
      {slug ? (
        <img src={productImageUrl(slug)} alt="" width={size - 8} height={size - 8} loading="lazy" draggable={false} />
      ) : (
        <Icon name="book" />
      )}
    </div>
  )
}
