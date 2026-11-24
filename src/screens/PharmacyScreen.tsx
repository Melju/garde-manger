import { useMemo } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { Icon } from '../components/Icon'
import { ProductItem } from '../components/ProductItem'
import { daysUntilExpiry, expiryStatus } from '../lib/expiry'
import { countLabel, countPerPack, isBareWeightUnit, remainingLabel } from '../lib/contenance'
import type { Product } from '../types'

interface PharmacyScreenProps {
  /** Absent en mode intégré à l'onglet Stock (sélecteur Garde-manger | Pharmacie). */
  onBack?: () => void
  topSlot?: React.ReactNode
  onAdd: () => void
  onEdit: (p: Product) => void
}

/** Pharmacie : médicaments et soins, triés par date de péremption, à part du stock alimentaire. */
export function PharmacyScreen({ onBack, onAdd, onEdit, topSlot }: PharmacyScreenProps) {
  const { pharmacy, adjustQuantity, updateProduct, addProduct, wasteProduct } = useStore()
  const toast = useToast()

  const groups = useMemo(() => {
    const byDate = [...pharmacy].sort(
      (a, b) => (daysUntilExpiry(a) ?? Infinity) - (daysUntilExpiry(b) ?? Infinity) || a.name.localeCompare(b.name),
    )
    return {
      expired: byDate.filter((p) => expiryStatus(p) === 'expired'),
      soon: byDate.filter((p) => expiryStatus(p) === 'soon'),
      ok: byDate.filter((p) => expiryStatus(p) === 'ok'),
      none: byDate.filter((p) => expiryStatus(p) === 'none'),
    }
  }, [pharmacy])

  async function handleRemoveQty(product: Product, qty: number | 'all') {
    const delta = qty === 'all' ? -product.quantity : -qty
    await adjustQuantity(product.id, delta)
    const remaining = qty === 'all' ? 0 : product.quantity - qty
    toast(remaining <= 0 ? `${product.name} retiré de la pharmacie` : `${product.name} : ×${remaining}`)
  }

  async function handleWaste(product: Product) {
    const orig = pharmacy.find((p) => p.id === product.id)
    await wasteProduct(product.id, orig && orig.quantity > 1 && product.quantity === 1 ? 1 : undefined)
    toast(`${product.name} retiré : à rapporter en pharmacie`)
  }

  // Comprimés, sachets… répartis sur plusieurs boîtes : boîtes entières d'abord, la dernière entamée devient un lot à part.
  async function handleConsumeSachets(product: Product, n: number) {
    const info = countPerPack(product.size)
    if (!info) return
    const { per, unit } = info
    const remaining = product.quantity * per - n
    if (remaining <= 0) {
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
      return
    }
    const full = Math.floor(remaining / per)
    const rem = remaining % per
    const partial = `${rem} ${unit}/${per} ${unit}`
    if (rem === 0) await updateProduct(product.id, { quantity: full })
    else if (full === 0) await updateProduct(product.id, { quantity: 1, size: partial })
    else {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = product
      await updateProduct(product.id, { quantity: full })
      await addProduct({ ...rest, quantity: 1, size: partial })
    }
    toast(`${product.name} : ${countLabel(remaining, unit)} restant${remaining > 1 ? 's' : ''}`)
  }

  async function handleConsumePortion(product: Product, newSize: string | null) {
    const orig = pharmacy.find((p) => p.id === product.id)
    if (orig && orig.quantity > 1 && product.quantity === 1) {
      if (newSize === null) {
        await adjustQuantity(product.id, -1)
        toast(`${product.name} terminé`)
      } else {
        const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = orig
        await updateProduct(product.id, { quantity: orig.quantity - 1 })
        await addProduct({ ...rest, quantity: 1, size: newSize })
        toast(`${product.name} : ${remainingLabel(newSize)} restant`)
      }
      return
    }
    if (newSize === null) {
      await adjustQuantity(product.id, -Math.max(1, product.quantity))
      toast(`${product.name} terminé`)
    } else {
      await updateProduct(product.id, isBareWeightUnit(product.size) ? { size: newSize, quantity: 1 } : { size: newSize })
      toast(`${product.name} : ${remainingLabel(newSize)} restant`)
    }
  }

  const section = (title: string, list: Product[], note?: string) =>
    list.length > 0 && (
      <div className="pharma-section" key={title}>
        <div className="pharma-title">
          {title} <span>{list.length}</span>
        </div>
        {note && <div className="pharma-note">{note}</div>}
        {list.map((p) => (
          <ProductItem
            key={p.id}
            product={p}
            onSelect={onEdit}
            onRemoveQty={handleRemoveQty}
            onWaste={handleWaste}
            onConsumePortion={handleConsumePortion}
            onConsumeSachets={handleConsumeSachets}
          />
        ))}
      </div>
    )

  return (
    <div className="screen-fade">
      {onBack ? (
        <PageHeader
          title="Pharmacie"
          onBack={onBack}
          action={
            <button className="icon-btn" onClick={onAdd} aria-label="Ajouter un médicament">
              <Icon name="plus" />
            </button>
          }
        />
      ) : (
        <header className="header">
          <div className="header-left">
            <h1 className="logo"><img src={`${import.meta.env.BASE_URL}logo.webp`} alt="Miam miam" /></h1>
          </div>
        </header>
      )}
      {topSlot}

      {pharmacy.length === 0 ? (
        <div className="empty-state">
          <Icon name="pill" />
          <p>
            Aucun médicament pour l’instant.
            <br />
            Ajoute ceux de ton armoire à pharmacie pour suivre leurs dates de péremption.
          </p>
          {onBack && (
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={onAdd}>
              Ajouter un médicament
            </button>
          )}
        </div>
      ) : (
        <div className="product-list">
          <div className="pharma-summary">
            <div className={`pharma-stat${groups.expired.length ? ' danger' : ''}`}>
              <div className="value">{groups.expired.length}</div>
              <div className="label">périmé{groups.expired.length > 1 ? 's' : ''}</div>
            </div>
            <div className={`pharma-stat${groups.soon.length ? ' warn' : ''}`}>
              <div className="value">{groups.soon.length}</div>
              <div className="label">à renouveler sous 30 jours</div>
            </div>
            <div className="pharma-stat">
              <div className="value">{pharmacy.length}</div>
              <div className="label">en tout</div>
            </div>
          </div>
          {section('Périmés', groups.expired, 'Ne les jette pas à la poubelle : rapporte-les en pharmacie, qui s’occupe de les recycler.')}
          {section('À renouveler bientôt', groups.soon)}
          {section('En ordre', groups.ok)}
          {section('Sans date', groups.none, 'Ajoute la date inscrite sur la boîte pour être prévenu.')}
        </div>
      )}
    </div>
  )
}
