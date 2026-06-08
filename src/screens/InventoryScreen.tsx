import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { ProductItem } from '../components/ProductItem'
import { CATEGORIES, type Category, type Product } from '../types'
import { expiryLabel, priorityProducts, urgentCount } from '../lib/expiry'

interface InventoryScreenProps {
  onAdd: () => void
  onScan: () => void
  onEdit: (product: Product) => void
  onOpenShopping: () => void
}

type Filter = 'tout' | Category

export function InventoryScreen({ onAdd, onScan, onEdit, onOpenShopping }: InventoryScreenProps) {
  const { products, adjustQuantity } = useStore()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('tout')

  const priority = useMemo(() => priorityProducts(products), [products])
  const urgent = useMemo(() => urgentCount(products), [products])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (filter !== 'tout' && p.category !== filter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [products, search, filter])

  async function handleRemoveQty(product: Product, qty: number | 'all') {
    const delta = qty === 'all' ? -product.quantity : -qty
    await adjustQuantity(product.id, delta)
    const remaining = qty === 'all' ? 0 : product.quantity - qty
    toast(remaining <= 0 ? `${product.name} retiré du stock` : `${product.name} : ×${remaining}`)
  }

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Garde-Manger</h1>
          <p>{products.length} produits en stock</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn" onClick={onScan} aria-label="Scanner un code-barres">
            <Icon name="scan" />
          </button>
          <button className="icon-btn" onClick={onAdd} aria-label="Ajouter un produit">
            <Icon name="plus" />
          </button>
        </div>
      </header>

      <div className="stats-strip">
        <div className="stat-box">
          <div className="value">{products.length}</div>
          <div className="label">Produits</div>
        </div>
        <div className={`stat-box${urgent > 0 ? ' alert' : ''}`}>
          <div className="value">{urgent}</div>
          <div className="label">Urgent</div>
        </div>
        <div className="stat-box" onClick={onOpenShopping}>
          <div className="value">{priority.length}</div>
          <div className="label">À surveiller</div>
        </div>
      </div>

      {priority.length > 0 && (
        <div className="priority-section">
          <div className="priority-header">
            <Icon name="alert" />
            <h2>À consommer en priorité</h2>
          </div>
          <div className="priority-scroll">
            {priority.map((p) => (
              <div key={p.id} className="priority-card" onClick={() => onEdit(p)}>
                <div className="name">{p.name}</div>
                <div className="expiry">{expiryLabel(p)}</div>
                <div className="qty">
                  ×{p.quantity}
                  {p.unit ? ` ${p.unit}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="search-row">
        <div className="search-input">
          <Icon name="search" />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        <button
          className={`filter-tab${filter === 'tout' ? ' active' : ''}`}
          onClick={() => setFilter('tout')}
        >
          Tout
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`filter-tab${filter === c.id ? ' active' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="product-list">
        <div className="list-header">
          <span className="list-title">
            {filter === 'tout' ? 'Tous les produits' : CATEGORIES.find((c) => c.id === filter)?.label}
          </span>
          <span className="list-count">{filtered.length} articles</span>
        </div>

        {filtered.length > 0 ? (
          <>
            <div className="swipe-hint">
              <Icon name="back" />
              Glissez vers la gauche pour retirer
            </div>
            {filtered.map((p) => (
              <ProductItem key={p.id} product={p} onSelect={onEdit} onRemoveQty={handleRemoveQty} />
            ))}
          </>
        ) : (
          <div className="empty-state">
            <Icon name="box" />
            <p>
              {products.length === 0
                ? 'Aucun produit. Ajoutez-en un avec le bouton +.'
                : 'Aucun produit ne correspond.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
