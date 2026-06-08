import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import {
  CATEGORIES,
  CONSERVATIONS,
  defaultConservation,
  type Category,
  type Conservation,
  type DateType,
  type Product,
  type ProductInput,
} from '../types'
import { estimateShelfLife, estimatedExpiryISO, durationLabel } from '../lib/shelfLife'

interface ProductFormScreenProps {
  product: Product | null
  initial?: Partial<ProductInput>
  onClose: () => void
}

export function ProductFormScreen({ product, initial, onClose }: ProductFormScreenProps) {
  const { addProduct, updateProduct, removeProduct, adjustQuantity, wasteProduct } = useStore()
  const toast = useToast()
  const isEdit = product !== null

  const initCategory = product?.category ?? initial?.category ?? 'autre'
  const [name, setName] = useState(product?.name ?? initial?.name ?? '')
  const [category, setCategory] = useState<Category>(initCategory)
  const [conservation, setConservation] = useState<Conservation>(
    product?.conservation ?? initial?.conservation ?? defaultConservation(initCategory),
  )
  const [quantity, setQuantity] = useState(product?.quantity ?? initial?.quantity ?? 1)
  const [size, setSize] = useState(product?.size ?? initial?.size ?? '')
  const [dateType, setDateType] = useState<DateType>(product?.dateType ?? initial?.dateType ?? 'dlc')
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate ?? initial?.expiryDate ?? '')
  const [location, setLocation] = useState(product?.location ?? initial?.location ?? '')
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '')
  const barcode = product?.barcode ?? initial?.barcode

  const canSave = name.trim().length > 0 && quantity > 0

  const estimate = useMemo(
    () => estimateShelfLife(name, conservation, category),
    [name, conservation, category],
  )
  function applyEstimate() {
    const iso = estimatedExpiryISO(name, conservation, category)
    if (iso) setExpiryDate(iso)
  }

  // Quand on change de catégorie, on aligne la conservation par défaut.
  function pickCategory(c: Category) {
    setCategory(c)
    setConservation(defaultConservation(c))
  }

  function buildInput(): ProductInput {
    return {
      name: name.trim(),
      category,
      conservation,
      quantity,
      size: size.trim() || undefined,
      dateType,
      expiryDate: expiryDate || undefined,
      location: location.trim() || undefined,
      price: price ? Number(price.replace(',', '.')) || undefined : undefined,
      barcode,
    }
  }

  async function handleSave() {
    if (!canSave) return
    if (isEdit && product) {
      await updateProduct(product.id, buildInput())
      toast('Produit mis à jour')
    } else {
      await addProduct(buildInput())
      toast('Produit ajouté')
    }
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
  async function handleDelete() {
    if (!product) return
    if (!confirm(`Supprimer « ${product.name} » ?`)) return
    await removeProduct(product.id)
    toast('Produit supprimé')
    onClose()
  }

  return (
    <div className="screen-fade">
      <div className="page-header">
        <button className="back-btn" onClick={onClose} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1 style={{ flex: 1 }}>{isEdit ? 'Modifier le produit' : 'Ajouter un produit'}</h1>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="name">Nom du produit</label>
        <input
          id="name"
          className="form-input"
          placeholder="Ex : Tomates, Poulet, Lait…"
          value={name}
          autoFocus={!isEdit}
          onChange={(e) => setName(e.target.value)}
        />
        {barcode && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Code-barres : {barcode}</p>
        )}
      </div>

      <div className="form-section">
        <label className="form-label">Conservation</label>
        <div className="opt-grid">
          {CONSERVATIONS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`opt-btn${conservation === c.id ? ' active' : ''}`}
              onClick={() => setConservation(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Catégorie</label>
        <div className="opt-grid">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`opt-btn${category === c.id ? ' active' : ''}`}
              onClick={() => pickCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-row">
          <div>
            <label className="form-label">Quantité</label>
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
          </div>
          <div>
            <label className="form-label">Contenance</label>
            <input
              className="form-input"
              placeholder="400g, 1L…"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Type de date</label>
        <div className="opt-grid two">
          <button
            type="button"
            className={`opt-btn date${dateType === 'dlc' ? ' active' : ''}`}
            onClick={() => setDateType('dlc')}
          >
            DLC<span className="sub">À consommer jusqu'au</span>
          </button>
          <button
            type="button"
            className={`opt-btn date${dateType === 'ddm' ? ' active' : ''}`}
            onClick={() => setDateType('ddm')}
          >
            DDM<span className="sub">À consommer de préférence avant</span>
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="expiry">Date de péremption</label>
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
        <label className="form-label" htmlFor="location">Emplacement (optionnel)</label>
        <input
          id="location"
          className="form-input"
          placeholder="Placard cuisine, Réfrigérateur…"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="price">Prix en € (optionnel)</label>
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

      <div className="btn-row" style={{ marginBottom: isEdit ? 12 : 0 }}>
        <button className="btn-secondary" onClick={onClose}>Annuler</button>
        <button className="btn-primary" disabled={!canSave} onClick={handleSave}>
          {isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>

      {isEdit && (
        <>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn-secondary" onClick={handleConsume}>Consommer 1</button>
            <button className="btn-secondary btn-danger" onClick={handleWaste}>Jeter (périmé)</button>
          </div>
          <div className="btn-row">
            <button className="btn-secondary btn-danger" onClick={handleDelete}>Supprimer le produit</button>
          </div>
        </>
      )}
    </div>
  )
}
