import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { CATEGORIES, type Category, type Product, type ProductInput } from '../types'
import { estimateShelfLife, estimatedExpiryISO, durationLabel } from '../lib/shelfLife'

interface ProductFormScreenProps {
  /** Produit à éditer, ou null pour une création. */
  product: Product | null
  /** Valeurs pré-remplies pour une création (ex : issues du scan). */
  initial?: Partial<ProductInput>
  onClose: () => void
}

export function ProductFormScreen({ product, initial, onClose }: ProductFormScreenProps) {
  const { addProduct, updateProduct, removeProduct, adjustQuantity, wasteProduct } = useStore()
  const toast = useToast()
  const isEdit = product !== null

  const [name, setName] = useState(product?.name ?? initial?.name ?? '')
  const [category, setCategory] = useState<Category>(product?.category ?? initial?.category ?? 'frais')
  const [quantity, setQuantity] = useState(product?.quantity ?? initial?.quantity ?? 1)
  const [unit, setUnit] = useState(product?.unit ?? initial?.unit ?? '')
  const [size, setSize] = useState(product?.size ?? initial?.size ?? '')
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate ?? initial?.expiryDate ?? '')
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '')
  const barcode = product?.barcode ?? initial?.barcode

  const canSave = name.trim().length > 0 && quantity > 0

  // Estimation de péremption d'après le type d'aliment (si pas de date saisie).
  const estimate = useMemo(() => estimateShelfLife(name, category), [name, category])
  function applyEstimate() {
    const iso = estimatedExpiryISO(name, category)
    if (iso) setExpiryDate(iso)
  }

  async function handleSave() {
    if (!canSave) return
    const input = {
      name: name.trim(),
      category,
      quantity,
      unit: unit.trim() || undefined,
      size: size.trim() || undefined,
      expiryDate: expiryDate || undefined,
      price: price ? Number(price.replace(',', '.')) || undefined : undefined,
      barcode,
    }
    if (isEdit && product) {
      await updateProduct(product.id, input)
      toast('Produit mis à jour')
    } else {
      await addProduct(input)
      toast('Produit ajouté')
    }
    onClose()
  }

  async function handleDelete() {
    if (!product) return
    if (!confirm(`Supprimer « ${product.name} » ?`)) return
    await removeProduct(product.id)
    toast('Produit supprimé')
    onClose()
  }

  async function handleConsume() {
    if (!product) return
    await adjustQuantity(product.id, -1)
    toast('1 consommé')
    onClose()
  }

  async function handleWaste() {
    if (!product) return
    if (!confirm(`Marquer « ${product.name} » comme jeté ?`)) return
    await wasteProduct(product.id)
    toast('Produit jeté')
    onClose()
  }

  return (
    <div className="screen-fade">
      <div className="page-header">
        <button className="back-btn" onClick={onClose} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h1>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="name">Nom</label>
        <input
          id="name"
          className="form-input"
          placeholder="Ex : Tomates pelées"
          value={name}
          autoFocus={!isEdit}
          onChange={(e) => setName(e.target.value)}
        />
        {barcode && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            Code-barres scanné : {barcode}
          </p>
        )}
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="category">Catégorie</label>
        <select
          id="category"
          className="form-select"
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="form-section">
        <label className="form-label">Quantité</label>
        <div className="form-row">
          <div className="qty-stepper">
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Diminuer">−</button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            />
            <button type="button" onClick={() => setQuantity((q) => q + 1)} aria-label="Augmenter">+</button>
          </div>
          <input
            className="form-input"
            placeholder="Unité (packs, g…)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </div>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="size">Conditionnement (optionnel)</label>
        <input
          id="size"
          className="form-input"
          placeholder="Ex : 400g, 1L"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="expiry">Date de péremption (optionnel)</label>
        <input
          id="expiry"
          type="date"
          className="form-input"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
        {estimate && !expiryDate && (
          <button type="button" className="estimate-hint" onClick={applyEstimate}>
            <span>
              Péremption estimée : <strong>{durationLabel(estimate.days)}</strong> ({estimate.group})
            </span>
            <span className="estimate-apply">Appliquer</span>
          </button>
        )}
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="price">Prix unitaire en € (optionnel)</label>
        <input
          id="price"
          type="text"
          inputMode="decimal"
          className="form-input"
          placeholder="Ex : 2.50 — alimente le budget"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
          {isEdit ? 'Enregistrer' : 'Ajouter au stock'}
        </button>
      </div>

      {isEdit && (
        <>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn-secondary" onClick={handleConsume}>
              Consommer 1
            </button>
            <button className="btn-secondary btn-danger" onClick={handleWaste}>
              Jeter (périmé)
            </button>
          </div>
          <div className="btn-row">
            <button className="btn-secondary btn-danger" onClick={handleDelete}>
              Supprimer le produit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
