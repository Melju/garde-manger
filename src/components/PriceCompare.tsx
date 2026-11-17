import { euros, pricesByStore, usePriceObs } from '../lib/prices'

/** Comparatif des derniers prix relevés par magasin pour un produit. */
export function PriceCompare({ name }: { name: string }) {
  const obs = usePriceObs()
  const list = pricesByStore(obs, name)
  if (list.length === 0) return null
  const best = list[0]
  const unit = list.length > 1 && list.every((p) => p.unitPrice != null && p.unitLabel === list[0].unitLabel)
  return (
    <div className="price-compare">
      <div className="pc-title">
        {list.length > 1 ? (
          <>
            Moins cher chez <strong>{best.store}</strong>
          </>
        ) : (
          <>Prix relevé</>
        )}
      </div>
      {list.map((p, i) => (
        <div className={`pc-row${i === 0 && list.length > 1 ? ' best' : ''}`} key={p.store}>
          <span className="pc-store">{p.store}</span>
          <span className="pc-date">{new Date(p.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
          <span className="pc-price">
            {euros(p.price)}
            {unit && p.unitPrice != null && <small> · {euros(p.unitPrice)}/{p.unitLabel}</small>}
          </span>
        </div>
      ))}
    </div>
  )
}
