import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { QuantityWheel } from '../components/QuantityWheel'
import { CATEGORIES, categoryLabel, type Category, type ShoppingItem } from '../types'

export function ShoppingScreen() {
  const {
    shopping,
    products,
    history,
    addShoppingItem,
    toggleShoppingItem,
    removeShoppingItem,
    clearCheckedShopping,
  } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('autre')
  const [qty, setQty] = useState(1)
  const [browseAll, setBrowseAll] = useState(false)

  const remaining = shopping.filter((it) => !it.checked).length

  // Catalogue « déjà acheté » : produits en stock + noms tirés de l'historique.
  const catalog = useMemo(() => {
    const map = new Map<string, { name: string; category: Category }>()
    for (const p of products) {
      const k = p.name.trim().toLowerCase()
      if (k && !map.has(k)) map.set(k, { name: p.name.trim(), category: p.category })
    }
    for (const h of history) {
      if (h.kind === 'prepare') continue
      const m = h.label.match(/^(.*?)\s(ajouté|consommé|jeté)/)
      if (!m) continue
      const nm = m[1].trim()
      const k = nm.toLowerCase()
      if (k && !map.has(k)) map.set(k, { name: nm, category: 'autre' })
    }
    const inList = new Set(shopping.map((it) => it.name.trim().toLowerCase()))
    return [...map.values()].filter((it) => !inList.has(it.name.toLowerCase()))
  }, [products, history, shopping])

  // Suggestions filtrées par la saisie (autocomplétion).
  const typed = name.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!typed) return []
    return catalog.filter((it) => it.name.toLowerCase().includes(typed)).slice(0, 6)
  }, [catalog, typed])

  // Regroupement par catégorie, dans l'ordre défini.
  const grouped = useMemo(() => {
    const map = new Map<Category, ShoppingItem[]>()
    for (const it of shopping) {
      const arr = map.get(it.category) ?? []
      arr.push(it)
      map.set(it.category, arr)
    }
    return CATEGORIES.map((c) => ({ category: c.id, items: map.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0,
    )
  }, [shopping])

  async function handleAdd() {
    const trimmed = name.trim()
    if (!trimmed) return
    await addShoppingItem({ name: trimmed, category, quantity: qty, source: 'manuel' })
    setName('')
    setQty(1)
    toast('Ajouté à la liste')
  }

  async function quickAdd(item: { name: string; category: Category }) {
    await addShoppingItem({ name: item.name, category: item.category, quantity: qty, source: 'manuel' })
    setName('')
    setQty(1)
    toast(`${item.name}${qty > 1 ? ` ×${qty}` : ''} ajouté`)
  }

  /** Ajoute à la liste les produits dont le stock est faible (≤ 1) et absents de la liste. */
  async function handleGenerate() {
    const existing = new Set(shopping.map((it) => it.name.toLowerCase()))
    const low = products.filter((p) => p.quantity <= 1 && !existing.has(p.name.toLowerCase()))
    if (low.length === 0) {
      toast('Aucun stock faible à ajouter')
      return
    }
    for (const p of low) {
      await addShoppingItem({ name: p.name, category: p.category, quantity: 1, source: 'auto' })
    }
    toast(`${low.length} article${low.length > 1 ? 's' : ''} ajouté${low.length > 1 ? 's' : ''}`)
  }

  return (
    <div className="screen-fade">
      <header className="header">
        <div className="header-left">
          <h1>Liste de courses</h1>
          <p>{remaining} article{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}</p>
        </div>
        <div className="header-actions">
          {shopping.some((it) => it.checked) && (
            <button
              className="icon-btn"
              onClick={async () => {
                await clearCheckedShopping()
                toast('Articles cochés effacés')
              }}
              aria-label="Effacer les articles cochés"
            >
              <Icon name="check" />
            </button>
          )}
        </div>
      </header>

      <div className="search-row">
        <div className="search-input">
          <input
            type="text"
            placeholder="Ajouter un article..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd()
            }}
          />
          <select
            className="form-select"
            style={{ width: 'auto', height: 36, border: 'none', padding: '0 8px', fontSize: 16 }}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button className="icon-btn" onClick={handleAdd} aria-label="Ajouter" style={{ width: 36, height: 36 }}>
            <Icon name="plus" />
          </button>
        </div>
      </div>

      {/* Quantité à acheter (roulette) */}
      <div className="qty-row">
        <span className="qty-row-label">Quantité</span>
        <QuantityWheel value={qty} onChange={setQty} max={30} />
        <span className="qty-row-value">×{qty}</span>
      </div>

      {/* Autocomplétion pendant la saisie */}
      {suggestions.length > 0 && (
        <div className="suggest-list">
          {suggestions.map((it) => (
            <button key={it.name} className="suggest-row" onClick={() => quickAdd(it)}>
              <Icon name="plus" width={2} />
              <span className="suggest-name">{it.name}</span>
              <span className="suggest-cat">{categoryLabel(it.category)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Panneau « Déjà achetés » repliable (compact) */}
      {!typed && catalog.length > 0 && (
        <div className="browse">
          <button className="browse-toggle" onClick={() => setBrowseAll((b) => !b)}>
            <Icon name="cart" width={2} />
            Déjà achetés ({catalog.length})
            <Icon name="chevron" width={2} className={browseAll ? 'rot' : ''} />
          </button>
          {browseAll && (
            <div className="quick-add-chips">
              {catalog.map((it) => (
                <button key={it.name} className="quick-chip" onClick={() => quickAdd(it)}>
                  <Icon name="plus" width={2.4} />
                  {it.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button className="generate-list-btn" onClick={handleGenerate}>
        <Icon name="sparkles" />
        Générer depuis les stocks faibles
      </button>

      {grouped.length === 0 ? (
        <div className="empty-state">
          <Icon name="cart" />
          <p>Votre liste est vide.</p>
        </div>
      ) : (
        grouped.map((group) => (
          <div className="shopping-category" key={group.category}>
            <div className="shopping-category-title">{categoryLabel(group.category)}</div>
            {group.items.map((it) => (
              <div
                key={it.id}
                className={`shopping-item${it.checked ? ' checked' : ''}`}
                onClick={() => toggleShoppingItem(it.id)}
              >
                <div className="checkbox">
                  <Icon name="check" width={3} />
                </div>
                <span className="shopping-name">{it.name}</span>
                <span className="shopping-qty">
                  ×{it.quantity}
                  {it.unit ? ` ${it.unit}` : ''}
                </span>
                {it.source === 'auto' && <span className="shopping-source">auto</span>}
                <button
                  className="shopping-delete"
                  aria-label="Retirer"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeShoppingItem(it.id)
                  }}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
