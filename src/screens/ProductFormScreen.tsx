import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import {
  CATEGORIES,
  defaultConservation,
  type Category,
  type Conservation,
  type DateType,
  type Product,
  type ProductInput,
} from '../types'
import { splitSize } from '../lib/contenance'
import { estimateShelfLife, estimatedExpiryISO, durationLabel, guessDateType } from '../lib/shelfLife'
import { DatePicker } from '../components/DatePicker'
import { DateScanner, type ScannedDate } from '../components/DateScanner'
import { getCurrentStore, getStores, setProductStores, storesFor } from '../lib/stores'
import { rememberProduct } from '../lib/productMemory'
import { learn } from '../lib/learnedShelf'
import { productImageSlug, productImageUrl, chosenIconSlug, chosenIconValue, realPhotoUrl } from '../lib/productImage'
import { ICON_SLUGS } from '../lib/iconList'
import { normalize } from '../lib/productIcon'
import { familyAllergenWarnings, allergenLabel } from '../lib/allergens'

/** Unités de contenance proposées. */
const SIZE_UNITS = ['g', 'kg', 'mL', 'cl', 'L', 'pièce', 'pack', 'boîte', 'sachet', 'pot', 'tranches']

/** Emplacements proposés (boutons). */
const LOCATIONS = ['Placard', 'Réfrigérateur', 'Congélateur', 'Cellier', 'Garde-manger', 'Cave', 'Corbeille']

/** Sépare une contenance « 400 g » en valeur + unité. */
function parseSize(s?: string): { value: string; unit: string } {
  if (!s) return { value: '', unit: '' }
  s = splitSize(s).current
  const m = s.trim().match(/^([\d.,]+)\s*(.*)$/)
  if (m) return { value: m[1], unit: m[2].trim() }
  return { value: '', unit: s.trim() }
}

interface ProductFormScreenProps {
  product: Product | null
  initial?: Partial<ProductInput>
  /** Fermeture (annuler / retour). */
  onClose: () => void
  /** Appelé après un enregistrement réussi (par défaut = onClose). */
  onSaved?: (saved: { name: string; quantity: number }) => void
}

export function ProductFormScreen({ product, initial, onClose, onSaved }: ProductFormScreenProps) {
  const { addProduct, updateProduct, removeProduct, adjustQuantity, wasteProduct, enrichProduct, family } = useStore()
  const toast = useToast()
  const isEdit = product !== null
  const [enriching, setEnriching] = useState(false)
  const [scanningDate, setScanningDate] = useState(false)
  // Magasins où ce produit s'achète : ceux déjà connus, sinon le magasin courant pour un nouveau produit.
  const [shops, setShops] = useState<string[]>(() => {
    const known = storesFor(product?.name ?? '')
    if (known.length) return known
    const cur = getCurrentStore()
    return !product && cur ? [cur] : []
  })
  const shopChoices = useMemo(() => [...new Set([...shops, ...getStores()])], [shops])
  function toggleShop(n: string) {
    setShops((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]))
  }

  function onDateScanned(r: ScannedDate) {
    setScanningDate(false)
    setExpiryDate(r.date)
    if (r.type) {
      dateTouched.current = true
      setDateType(r.type)
    }
    toast(
      r.confident
        ? `Date lue : ${r.raw || r.date}`
        : `Lecture incertaine (${r.raw || r.date}), vérifie la date`,
    )
  }
  // Durées de conservation par mode, fournies par l'IA (pour adapter la DLC).
  const [aiShelf, setAiShelf] = useState<{ frais: number; refrigere: number; congele: number } | null>(null)

  function isoInDays(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  // Données enrichies Open Food Facts (lecture seule, conservées telles quelles).
  const enrich = {
    imageUrl: realPhotoUrl(product?.imageUrl ?? initial?.imageUrl),
    nutriscore: product?.nutriscore ?? initial?.nutriscore,
    nova: product?.nova ?? initial?.nova,
    kcal: product?.kcal ?? initial?.kcal,
    allergens: product?.allergens ?? initial?.allergens,
  }
  const warnings = familyAllergenWarnings(enrich.allergens, family)
  const hasEnrich =
    enrich.imageUrl || enrich.nutriscore || enrich.nova || enrich.kcal != null || warnings.length > 0

  const initCategory = product?.category ?? initial?.category ?? 'autre'
  const initConservation =
    product?.conservation ?? initial?.conservation ?? defaultConservation(initCategory)
  const [name, setName] = useState(product?.name ?? initial?.name ?? '')
  const [category, setCategory] = useState<Category>(initCategory)
  const [conservation, setConservation] = useState<Conservation>(initConservation)
  const [quantity, setQuantity] = useState(product?.quantity ?? initial?.quantity ?? 1)
  const initSize = parseSize(product?.size ?? initial?.size)
  const [sizeValue, setSizeValue] = useState(initSize.value)
  const [sizeUnit, setSizeUnit] = useState(initSize.unit)
  const [chosenIcon, setChosenIcon] = useState<string | null>(chosenIconSlug(product?.imageUrl))
  const [pickingIcon, setPickingIcon] = useState(false)
  const [iconQuery, setIconQuery] = useState('')
  const autoIcon = productImageSlug(name)
  const shownIcon = chosenIcon ?? autoIcon
  const iconChoices = useMemo(() => {
    const q = normalize(iconQuery).trim()
    return q ? ICON_SLUGS.filter((s) => s.replace(/-/g, ' ').includes(q)) : ICON_SLUGS
  }, [iconQuery])
  const [dateType, setDateType] = useState<DateType>(product?.dateType ?? initial?.dateType ?? 'dlc')
  const dateTouched = useRef(isEdit || !!initial?.dateType)
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate ?? initial?.expiryDate ?? '')
  const initLocation =
    product?.location ??
    initial?.location ??
    (initConservation === 'refrigere'
      ? 'Réfrigérateur'
      : initConservation === 'congele'
        ? 'Congélateur'
        : '')
  const [location, setLocation] = useState(initLocation)
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '')
  const barcode = product?.barcode ?? initial?.barcode

  const canSave = name.trim().length > 0 && quantity > 0

  const estimate = useMemo(
    () => estimateShelfLife(name, conservation, category),
    [name, conservation, category],
  )
  // Type de date proposé d'après le produit (DDM pour les pâtes, DLC pour la viande...), tant que tu n'as pas choisi toi-même.
  const dateGuess = useMemo(
    () => guessDateType(name, conservation, category),
    [name, conservation, category],
  )
  useEffect(() => {
    if (!dateTouched.current && name.trim().length >= 2) setDateType(dateGuess.type)
  }, [dateGuess, name])
  function applyEstimate() {
    const iso = estimatedExpiryISO(name, conservation, category)
    if (iso) setExpiryDate(iso)
  }

  // La conservation (frais / réfrigéré / congelé) se déduit de l'emplacement : plus de double saisie.
  function consOfLocation(l: string): Conservation {
    const n = l.toLowerCase()
    if (n.includes('congel') || n.includes('freez')) return 'congele'
    if (n.includes('frigo') || n.includes('refrig') || n.includes('réfrig')) return 'refrigere'
    return 'frais'
  }
  function pickLocation(l: string) {
    setLocation(l)
    const c = consOfLocation(l)
    setConservation(c)
    // Si l'IA a fourni des durées, la DLC suit l'emplacement choisi.
    if (aiShelf) {
      const days = aiShelf[c]
      if (days > 0) setExpiryDate(isoInDays(days))
    }
  }
  function pickConservation(c: Conservation) {
    if (c === 'refrigere') pickLocation('Réfrigérateur')
    else if (c === 'congele') pickLocation('Congélateur')
    else pickLocation(consOfLocation(location) === 'frais' ? location : '')
  }

  // Quand on change de catégorie, on aligne la conservation par défaut (et l'emplacement).
  function pickCategory(c: Category) {
    setCategory(c)
    pickConservation(defaultConservation(c))
  }

  // Pré-remplissage IA : devine catégorie/conservation/unité/DLC depuis le nom.
  async function aiComplete() {
    if (!name.trim() || enriching) return
    setEnriching(true)
    try {
      const r = await enrichProduct(name)
      setCategory(r.category)
      setAiShelf(r.shelfLife)
      if (r.unit && !sizeUnit) setSizeUnit(r.unit)
      // On RESPECTE le mode de conservation déjà choisi : la DLC est calculée
      // pour CE mode. (Change de mode → la date se recalcule automatiquement.)
      const days = r.shelfLife[conservation]
      if (days > 0) setExpiryDate(isoInDays(days))
      toast(`Pré-rempli par l’IA (${conservation}) — vérifie et ajuste`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Assistance indisponible')
    } finally {
      setEnriching(false)
    }
  }

  function buildInput(): ProductInput {
    const sizeStr = [sizeValue.trim(), sizeUnit].filter(Boolean).join(' ').trim()
    return {
      name: name.trim(),
      category,
      conservation,
      quantity,
      // Entamé (« 700 g/1 kg ») et contenance inchangée : on garde la quantité d'origine.
      size:
        product?.size && splitSize(product.size).full && splitSize(product.size).current.replace(/\s+/g, '') === sizeStr.replace(/\s+/g, '')
          ? product.size
          : sizeStr || undefined,
      dateType,
      expiryDate: expiryDate || undefined,
      location: location.trim() || undefined,
      price: price ? Number(price.replace(',', '.')) || undefined : undefined,
      barcode,
      imageUrl: chosenIcon ? chosenIconValue(chosenIcon) : enrich.imageUrl,
      nutriscore: enrich.nutriscore,
      nova: enrich.nova,
      kcal: enrich.kcal,
      allergens: enrich.allergens,
    }
  }

  async function handleSave() {
    if (!canSave) return
    const inp = buildInput()
    rememberProduct(inp)
    setProductStores(inp.name, inp.category, undefined, undefined, shops)
    learn({
      name: inp.name,
      category: inp.category,
      conservation: inp.conservation,
      expiryDate: inp.expiryDate,
      dateType: inp.dateType,
      from: isEdit && product ? product.createdAt : undefined,
      explicitDateType: dateTouched.current,
    })
    if (isEdit && product) {
      await updateProduct(product.id, inp)
      toast('Produit mis à jour')
    } else {
      await addProduct(buildInput())
      toast('Produit ajouté')
    }
    if (onSaved) onSaved({ name: inp.name, quantity: inp.quantity })
    else onClose()
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
        {name.trim() && (
          <button type="button" className="ai-complete-btn" onClick={aiComplete} disabled={enriching}>
            <Icon name="sparkles" width={2.2} />
            {enriching ? 'Analyse…' : 'Compléter avec l’IA'}
          </button>
        )}
        {barcode && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Code-barres : {barcode}</p>
        )}
      </div>

      <div className="form-section">
        <label className="form-label">Icône</label>
        <div className="icon-pick-row">
          <div className="icon-pick-current">
            {shownIcon ? <img src={productImageUrl(shownIcon)} alt="" width={48} height={48} /> : <span>?</span>}
          </div>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)' }}>
            {chosenIcon ? 'Choisie par toi' : shownIcon ? 'Choisie automatiquement' : 'Aucune icône trouvée'}
          </div>
          <button type="button" className="ai-complete-btn" style={{ margin: 0 }} onClick={() => setPickingIcon((v) => !v)}>
            {pickingIcon ? 'Fermer' : 'Changer'}
          </button>
        </div>
        {pickingIcon && (
          <div className="icon-picker">
            <input
              className="form-input"
              placeholder="Chercher une icône (pâtes, lait, tomate…)"
              value={iconQuery}
              onChange={(e) => setIconQuery(e.target.value)}
            />
            {chosenIcon && (
              <button
                type="button"
                className="icon-pick-auto"
                onClick={() => {
                  setChosenIcon(null)
                  setPickingIcon(false)
                }}
              >
                Revenir à l'icône automatique
              </button>
            )}
            <div className="icon-grid">
              {iconChoices.map((s) => (
                <button
                  key={s}
                  type="button"
                  title={s.replace(/-/g, ' ')}
                  className={`icon-cell${s === shownIcon ? ' active' : ''}`}
                  onClick={() => {
                    setChosenIcon(s)
                    setPickingIcon(false)
                  }}
                >
                  <img src={productImageUrl(s)} alt={s} width={44} height={44} loading="lazy" />
                </button>
              ))}
              {iconChoices.length === 0 && <p style={{ gridColumn: '1 / -1', color: 'var(--muted)' }}>Rien trouvé.</p>}
            </div>
          </div>
        )}
      </div>

      {hasEnrich && (
        <div className="form-section">
          <div className="enrich-card">
            {enrich.imageUrl && <img className="enrich-photo" src={enrich.imageUrl} alt="" />}
            <div className="enrich-info">
              <div className="enrich-badges">
                {enrich.nutriscore && (
                  <span className={`nutri-badge ns-${enrich.nutriscore}`}>
                    {enrich.nutriscore.toUpperCase()}
                  </span>
                )}
                {enrich.nova ? <span className="meta-badge">NOVA {enrich.nova}</span> : null}
                {enrich.kcal != null && <span className="meta-badge">{enrich.kcal} kcal/100g</span>}
                {!enrich.nutriscore && enrich.nova == null && enrich.kcal == null && (
                  <span className="meta-badge">Infos nutritionnelles indisponibles</span>
                )}
              </div>
              {warnings.length > 0 && (
                <div className="allergen-warn">
                  <Icon name="alert" />
                  <span>
                    {warnings
                      .map((w) => `${w.member.name} : ${w.allergens.map(allergenLabel).join(', ')}`)
                      .join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      <div className="form-section">
        <label className="form-label">Contenance (optionnel)</label>
        <div className="form-row">
          <input
            className="form-input"
            type="text"
            inputMode="decimal"
            placeholder={sizeUnit === 'sachet' ? 'Nombre de sachets' : 'Ex : 400'}
            value={sizeValue}
            onChange={(e) => setSizeValue(e.target.value)}
          />
          <select
            className="form-select"
            value={sizeUnit}
            onChange={(e) => setSizeUnit(e.target.value)}
          >
            <option value="">Unité…</option>
            {SIZE_UNITS.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Type de date</label>
        <div className="opt-grid two">
          <button
            type="button"
            className={`opt-btn date${dateType === 'dlc' ? ' active' : ''}`}
            onClick={() => { dateTouched.current = true; setDateType('dlc') }}
          >
            DLC<span className="sub">À consommer jusqu'au</span>
          </button>
          <button
            type="button"
            className={`opt-btn date${dateType === 'ddm' ? ' active' : ''}`}
            onClick={() => { dateTouched.current = true; setDateType('ddm') }}
          >
            DDM<span className="sub">À consommer de préférence avant</span>
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="expiry">Date de péremption</label>
        <DatePicker id="expiry" value={expiryDate} onChange={setExpiryDate} />
        <button type="button" className="ai-complete-btn" onClick={() => setScanningDate(true)}>
          <Icon name="scan" width={2.2} />
          Scanner la date
        </button>
        {scanningDate && <DateScanner onResult={onDateScanned} onClose={() => setScanningDate(false)} />}
        {estimate && !expiryDate && (
          <button type="button" className="estimate-hint" onClick={applyEstimate}>
            <span>
              Péremption estimée : <strong>{durationLabel(estimate.days)}</strong>{' '}
              {estimate.learned
                ? estimate.learned.exact
                  ? '(déjà renseigné pour ce produit)'
                  : `(d'après ${estimate.learned.count} produit${estimate.learned.count > 1 ? 's' : ''} similaire${estimate.learned.count > 1 ? 's' : ''})`
                : `(${estimate.group})`}
            </span>
            <span className="estimate-apply">Appliquer</span>
          </button>
        )}
      </div>

      <div className="form-section">
        <label className="form-label">Acheté chez (optionnel)</label>
        <div className="store-grid">
          {shopChoices.map((n) => (
            <button
              key={n}
              type="button"
              className={`store-opt${shops.includes(n) ? ' active' : ''}`}
              onClick={() => toggleShop(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <label className="form-label" htmlFor="location">Emplacement</label>
        <div className="opt-grid">
          {LOCATIONS.map((l) => (
            <button
              key={l}
              type="button"
              className={`opt-btn${location === l ? ' active' : ''}`}
              onClick={() => pickLocation(location === l ? '' : l)}
            >
              {l}
            </button>
          ))}
        </div>
        <input
          id="location"
          className="form-input"
          style={{ marginTop: 10 }}
          placeholder="Autre emplacement…"
          value={LOCATIONS.includes(location) ? '' : location}
          onChange={(e) => pickLocation(e.target.value)}
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
