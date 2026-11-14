import { useConfirm } from '../components/Confirm'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import {
  CATEGORIES,
  defaultConservation,
  isNonFood,
  type Category,
  type Conservation,
  type DateType,
  type Product,
  type ProductInput,
} from '../types'
import { splitSize, countUnit } from '../lib/contenance'
import { conservationOfLocation } from '../lib/location'
import { estimateShelfLife, estimatedExpiryISO, durationLabel, guessDateType, isFrozenName } from '../lib/shelfLife'
import { DatePicker } from '../components/DatePicker'
import { DateScanner, type ScannedDate } from '../components/DateScanner'
import { getCurrentStore, getStores, setProductStores, storeInName, storesFor } from '../lib/stores'
import { rememberProduct } from '../lib/productMemory'
import { learnPlace, placeFor, defaultPlace } from '../lib/learnedPlace'
import { guessCategoryFromName } from '../lib/categoryGuess'
import { learn } from '../lib/learnedShelf'
import { productImageSlug, productImageUrl, chosenIconSlug, chosenIconValue, realPhotoUrl } from '../lib/productImage'
import { ICON_SLUGS } from '../lib/iconList'
import { normalize } from '../lib/productIcon'
import { addBrand, getCustomBrands } from '../lib/brands'
import { familyAllergenWarnings, allergenLabel } from '../lib/allergens'

/** Unités de contenance proposées. */
const SIZE_UNITS = ['g', 'kg', 'mL', 'cl', 'L', 'pièce', 'pack', 'boîte', 'sachet', 'pot', 'tranche']

/** Emplacements proposés (boutons). */
const LOCATIONS = ['Placard', 'Réfrigérateur', 'Congélateur', 'Cellier', 'Cave', 'Corbeille']

/** Sépare une contenance « 400 g » en valeur + unité. */
function parseSize(s?: string): { value: string; unit: string } {
  if (!s) return { value: '', unit: '' }
  s = splitSize(s).current
  const m = s.trim().match(/^([\d.,]+)\s*(.*)$/)
  const norm = (u: string) => countUnit(u) ?? u
  if (m) return { value: m[1], unit: norm(m[2].trim()) }
  return { value: '', unit: norm(s.trim()) }
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
  const { addProduct, updateProduct, removeProduct, adjustQuantity, wasteProduct, enrichProduct, family, products } = useStore()
  const toast = useToast()
  const askConfirm = useConfirm()
  const isEdit = product !== null
  const [enriching, setEnriching] = useState(false)
  const [scanningDate, setScanningDate] = useState(false)
  // Magasins où ce produit s'achète : ceux déjà connus, sinon le magasin courant pour un nouveau produit.
  const [shops, setShops] = useState<string[]>(() => {
    const known = storesFor(product?.name ?? '')
    if (known.length) return known
    // Marque de distributeur dans le nom (ex : « Farce veggie Auchan ») : on coche ce magasin.
    const brandStore = product ? undefined : storeInName(`${initial?.name ?? ''} ${initial?.brand ?? ''}`)
    if (brandStore) return [brandStore]
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
  // L'emplacement prime sur la conservation enregistrée : « Congélateur » = congelé, même si la fiche dit « frais ».
  const initLoc = product?.location ?? initial?.location
  const initConservation = initLoc
    ? consOfLocation(initLoc)
    : (product?.conservation ?? initial?.conservation ?? defaultConservation(initCategory))
  const [name, setName] = useState(product?.name ?? initial?.name ?? '')
  const [brand, setBrand] = useState(product?.brand ?? initial?.brand ?? '')
  const [brandOpen, setBrandOpen] = useState(false)
  // Marques connues (par fréquence) et marques corrélées au nom saisi (produits aux mots communs).
  const { knownBrands, correlated } = useMemo(() => {
    const count = new Map<string, { label: string; n: number }>()
    const words = (s: string) => normalize(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4)
    const mine = new Set(words(name))
    const corr = new Map<string, { label: string; score: number }>()
    for (const p of products) {
      const b = p.brand?.trim()
      if (!b) continue
      const k = normalize(b)
      count.set(k, { label: b, n: (count.get(k)?.n ?? 0) + 1 })
      const shared = words(p.name).filter((w) => mine.has(w)).length
      if (shared) corr.set(k, { label: b, score: (corr.get(k)?.score ?? 0) + shared })
    }
    for (const b of getCustomBrands()) if (!count.has(normalize(b))) count.set(normalize(b), { label: b, n: 0 })
    return {
      knownBrands: [...count.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).map((x) => x.label),
      correlated: [...corr.values()].sort((a, b) => b.score - a.score).map((x) => x.label).slice(0, 5),
    }
  }, [products, name])
  const brandQ = normalize(brand).trim()
  const brandMatches = useMemo(
    () => knownBrands.filter((b) => !brandQ || normalize(b).includes(brandQ)).slice(0, 6),
    [knownBrands, brandQ],
  )
  const brandIsNew = brandQ !== '' && !knownBrands.some((b) => normalize(b) === brandQ)
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
  // Zone « déduite » repliée si tout est renseigné ; sinon ouverte pour requalifier.
  const [editDeduced, setEditDeduced] = useState(false)
  const [openBuy, setOpenBuy] = useState(false)
  const [expiryDate, setExpiryDate] = useState(product?.expiryDate ?? initial?.expiryDate ?? '')
  // Nouveau produit en plusieurs exemplaires : une date de péremption par article (le 1er utilise la date ci-dessus).
  const [perDate, setPerDate] = useState(false)
  const [extraDates, setExtraDates] = useState<string[]>([])
  const [extraScan, setExtraScan] = useState<number | null>(null)
  const setExtraAt = (i: number, v: string) => setExtraDates((d) => { const c = [...d]; c[i] = v; return c })
  const initLocation =
    product?.location ??
    initial?.location ??
    (initConservation === 'refrigere'
      ? 'Réfrigérateur'
      : initConservation === 'congele'
        ? 'Congélateur'
        : '')
  const [location, setLocation] = useState(initLocation)
  const showDeduced = editDeduced || category === 'autre' || !location
  const [price, setPrice] = useState(product?.price != null ? String(product.price) : '')
  const barcode = product?.barcode ?? initial?.barcode

  const canSave = name.trim().length > 0 && quantity > 0

  const nonFood = isNonFood(category)
  const estimate = useMemo(
    () => (isNonFood(category) ? null : estimateShelfLife(name, conservation, category)),
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
  // Date posée par l'estimation (et non saisie à la main) : elle suit alors l'emplacement choisi.
  const autoDate = useRef<string | null>(null)
  function applyEstimate() {
    const iso = estimatedExpiryISO(name, conservation, category)
    if (iso) {
      autoDate.current = iso
      setExpiryDate(iso)
    }
  }

  // La conservation (frais / réfrigéré / congelé) se déduit de l'emplacement : plus de double saisie.
  function consOfLocation(l: string): Conservation {
    return conservationOfLocation(l)
  }
  function pickLocation(l: string, cat: Category = category) {
    setLocation(l)
    const c = consOfLocation(l)
    setConservation(c)
    // Si l'IA a fourni des durées, la DLC suit l'emplacement choisi.
    if (aiShelf) {
      const days = aiShelf[c]
      if (days > 0) {
        const iso = isoInDays(days)
        autoDate.current = iso
        setExpiryDate(iso)
      }
    } else if (autoDate.current && expiryDate === autoDate.current) {
      // Date issue de l'estimation : on la recalcule pour ce nouvel emplacement.
      const iso = estimatedExpiryISO(name, c, cat)
      if (iso) {
        autoDate.current = iso
        setExpiryDate(iso)
      }
    }
  }
  const catTouched = useRef(isEdit || !!initial?.category)
  const locTouched = useRef(isEdit || !!initial?.location)
  const [placeSource, setPlaceSource] = useState<'name' | 'similar' | 'category' | null>(null)
  function userPickLocation(l: string) {
    locTouched.current = true
    setPlaceSource(null)
    pickLocation(l)
  }
  // Déduction : catégorie d'après le nom, puis rangement habituel (appris), sinon par défaut selon la catégorie.
  useEffect(() => {
    if (isEdit) return
    const n = name.trim()
    if (n.length < 3) return
    let cat = category
    if (!catTouched.current) {
      const g = guessCategoryFromName(n)
      if (g && g !== 'autre' && g !== category) {
        cat = g
        setCategory(g)
      }
    }
    if (!locTouched.current) {
      const learned = placeFor(n, cat)
      const l = isFrozenName(n) ? 'Congélateur' : (learned?.loc ?? defaultPlace(cat))
      setPlaceSource(learned?.source ?? null)
      if (l && l !== location) pickLocation(l, cat)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  function pickConservation(c: Conservation) {
    if (c === 'refrigere') pickLocation('Réfrigérateur')
    else if (c === 'congele') pickLocation('Congélateur')
    else pickLocation(consOfLocation(location) === 'frais' ? location : '')
  }

  // Quand on change de catégorie, on aligne la conservation par défaut (et l'emplacement).
  function pickCategory(c: Category) {
    catTouched.current = true
    setCategory(c)
    if (isNonFood(c)) {
      setExpiryDate('')
      setExtraDates([])
      autoDate.current = null
    }
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
      if (days > 0) {
        const iso = isoInDays(days)
        autoDate.current = iso
        setExpiryDate(iso)
      }
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
      brand: brand.trim() || undefined,
      category,
      conservation,
      quantity,
      // Entamé (« 700 g/1 kg ») et contenance inchangée : on garde la quantité d'origine.
      size:
        product?.size && splitSize(product.size).full && splitSize(product.size).current.replace(/\s+/g, '') === sizeStr.replace(/\s+/g, '')
          ? product.size
          : sizeStr || undefined,
      dateType,
      expiryDate: nonFood ? undefined : expiryDate || undefined,
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
    learnPlace(inp.name, inp.category, inp.location)
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
    if (isEdit && product && perDate && quantity > 1) {
      // Répartit les exemplaires par date : le lot de l'article 1 met à jour ce produit, les autres deviennent de nouveaux lots.
      const groups = new Map<string, number>()
      for (let i = 0; i < quantity; i++) {
        const d = (i === 0 ? expiryDate : extraDates[i - 1]) || ''
        groups.set(d, (groups.get(d) ?? 0) + 1)
      }
      const firstKey = expiryDate || ''
      await updateProduct(product.id, { ...inp, quantity: groups.get(firstKey) ?? 1, expiryDate: firstKey || undefined })
      for (const [d, count] of groups) {
        if (d === firstKey) continue
        await addProduct({ ...inp, quantity: count, expiryDate: d || undefined })
      }
      toast(`Produit réparti sur ${groups.size} date${groups.size > 1 ? 's' : ''}`)
    } else if (isEdit && product) {
      await updateProduct(product.id, inp)
      toast('Produit mis à jour')
    } else {
      const base = buildInput()
      if (perDate && quantity > 1) {
        // Regroupe les exemplaires par date : un lot par date différente.
        const groups = new Map<string, number>()
        for (let i = 0; i < quantity; i++) {
          const d = (i === 0 ? expiryDate : extraDates[i - 1]) || ''
          groups.set(d, (groups.get(d) ?? 0) + 1)
        }
        for (const [d, count] of groups) await addProduct({ ...base, quantity: count, expiryDate: d || undefined })
        toast(`${quantity} articles ajoutés (${groups.size} date${groups.size > 1 ? 's' : ''})`)
      } else {
        await addProduct(base)
        toast('Produit ajouté')
      }
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
    if (!(await askConfirm({ title: `Marquer « ${product.name} » comme jeté ?`, confirmLabel: 'Jeté' }))) return
    await wasteProduct(product.id)
    toast('Produit jeté')
    onClose()
  }
  async function handleDelete() {
    if (!product) return
    if (!(await askConfirm({ title: `Supprimer « ${product.name} » ?`, message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true }))) return
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

      <div className="form-group product-hero">
        <div className="hero-name">
          <label className="form-label" htmlFor="name">Nom du produit</label>
          <input
            id="name"
            className="form-input"
            placeholder="Ex : Tomates, Poulet, Lait…"
            value={name}
            autoFocus={!isEdit}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="brand-field">
            <input
              id="brand"
              className="form-input"
              placeholder="Marque (facultatif)"
              aria-label="Marque"
              autoComplete="off"
              value={brand}
              onFocus={() => setBrandOpen(true)}
              onBlur={() => setTimeout(() => setBrandOpen(false), 150)}
              onChange={(e) => {
                setBrand(e.target.value)
                setBrandOpen(true)
              }}
            />
            {brand && (
              <button type="button" className="brand-clear" aria-label="Effacer la marque" onMouseDown={(e) => e.preventDefault()} onClick={() => setBrand('')}>
                ×
              </button>
            )}
            {brandOpen && (brandMatches.length > 0 || brandIsNew) && (
              <div className="brand-menu">
                {brandMatches.map((b) => (
                  <button key={b} type="button" className="brand-opt" onMouseDown={(e) => e.preventDefault()} onClick={() => { setBrand(b); setBrandOpen(false) }}>
                    {b}
                  </button>
                ))}
                {brandIsNew && (
                  <button type="button" className="brand-opt add" onMouseDown={(e) => e.preventDefault()} onClick={() => { addBrand(brand); setBrand(brand.trim()); setBrandOpen(false) }}>
                    + Ajouter « {brand.trim()} »
                  </button>
                )}
              </div>
            )}
          </div>
          {!brand.trim() && correlated.length > 0 && (
            <div className="brand-suggest">
              <span>Souvent avec ce type de produit :</span>
              {correlated.map((b) => (
                <button key={b} type="button" className="usual-chip" onClick={() => setBrand(b)}>
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="hero-row">
          <div className="hero-icon-col">
            <button type="button" className="hero-icon" onClick={() => setPickingIcon((v) => !v)} aria-label="Changer l'icône">
              {shownIcon ? <img src={productImageUrl(shownIcon)} alt="" /> : <span>?</span>}
            </button>
          </div>
          <div className="hero-info">
            {hasEnrich && (
              <div className="enrich-badges hero-badges">
                {enrich.nutriscore && (
                  <span className={`nutri-badge ns-${enrich.nutriscore}`}>{enrich.nutriscore.toUpperCase()}</span>
                )}
                {enrich.nova ? <span className="meta-badge">NOVA {enrich.nova}</span> : null}
                {enrich.kcal != null && <span className="meta-badge">{enrich.kcal} kcal/100g</span>}
                {!enrich.nutriscore && enrich.nova == null && enrich.kcal == null && (
                  <span className="meta-badge">Infos nutritionnelles indisponibles</span>
                )}
              </div>
            )}
            <div className="hero-meta">
              {barcode && <span className="hero-barcode">{barcode}</span>}
              {name.trim() && (
                <button type="button" className="ai-complete-btn hero-ai" onClick={aiComplete} disabled={enriching}>
                  <Icon name="sparkles" width={2.2} />
                  {enriching ? 'Analyse…' : 'Générer'}
                </button>
              )}
            </div>
          </div>
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
        {warnings.length > 0 && (
          <div className="form-section">
            <div className="allergen-warn">
              <Icon name="alert" />
              <span>
                {warnings
                  .map((w) => `${w.member.name} : ${w.allergens.map(allergenLabel).join(', ')}`)
                  .join(' · ')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="form-group">
        <h2 className="form-group-title">Stock</h2>
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
            placeholder={countUnit(sizeUnit) ? `Nombre (${sizeUnit}s par paquet)` : 'Ex : 400'}
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

      {!nonFood && (
      <div className="form-section">
        <label className="form-label" htmlFor="expiry">Date de péremption</label>
        <DatePicker id="expiry" value={expiryDate} onChange={setExpiryDate} />
        <button type="button" className="ai-complete-btn" onClick={() => setScanningDate(true)}>
          <Icon name="scan" width={2.2} />
          Scanner la date
        </button>
        {scanningDate && <DateScanner onResult={onDateScanned} onClose={() => setScanningDate(false)} />}
        {quantity > 1 && (
          <div className="scan-known-exp-actions" style={{ marginTop: 10 }}>
            <button type="button" className={`usual-chip${!perDate ? ' on' : ''}`} onClick={() => setPerDate(false)}>
              Même date pour tous
            </button>
            <button type="button" className={`usual-chip${perDate ? ' on' : ''}`} onClick={() => setPerDate(true)}>
              Une date par article
            </button>
          </div>
        )}
        {perDate && quantity > 1 && (
          <div className="form-multi">
            {Array.from({ length: quantity - 1 }, (_, k) => (
              <div key={k} className="scan-known-multi-row">
                <div className="scan-known-multi-n">Article {k + 2}</div>
                <DatePicker value={extraDates[k] || ''} onChange={(v) => setExtraAt(k, v)} />
                <div className="scan-known-exp-actions">
                  <button type="button" className="usual-chip" onClick={() => setExtraScan(k)}>Scanner</button>
                  {(k === 0 ? expiryDate : extraDates[k - 1]) && (extraDates[k] || '') !== (k === 0 ? expiryDate : extraDates[k - 1]) && (
                    <button type="button" className="usual-chip" onClick={() => setExtraAt(k, (k === 0 ? expiryDate : extraDates[k - 1]) || '')}>
                      Idem article {k + 1}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {extraScan !== null && (
          <DateScanner
            onResult={(r) => { setExtraAt(extraScan, r.date); setExtraScan(null) }}
            onClose={() => setExtraScan(null)}
          />
        )}
        {estimate && !expiryDate && (
          <button type="button" className="estimate-hint" onClick={applyEstimate}>
            <span>
              Péremption estimée : <strong>{durationLabel(estimate.days)}</strong>{' '}
              {estimate.learned
                ? estimate.learned.exact
                  ? '(déjà renseigné pour ce produit)'
                  : `(d'après ${estimate.learned.count} produit${estimate.learned.count > 1 ? 's' : ''} similaire${estimate.learned.count > 1 ? 's' : ''})`
                : `(${estimate.group}${conservation === 'congele' ? ', congélateur' : conservation === 'refrigere' ? ', frigo' : ''})`}
            </span>
            <span className="estimate-apply">Appliquer</span>
          </button>
        )}
      </div>
      )}

      </div>

      <div className="form-group deduced">
        <div className="deduced-head">
          <h2 className="form-group-title" style={{ margin: 0 }}>Déduit automatiquement</h2>
          {(editDeduced || !(category === 'autre' || !location)) && (
            <button type="button" className="deduced-toggle" onClick={() => setEditDeduced((v) => !v)}>
              {editDeduced ? 'Replier' : 'Modifier'}
            </button>
          )}
        </div>
        {!showDeduced && (
          <div className="deduced-summary">
            {CATEGORIES.find((c) => c.id === category)?.label ?? category} · {location || 'Emplacement ?'}{!nonFood && ` · ${dateType === 'dlc' ? 'DLC' : 'DDM'}`}
            {placeSource && <span className="deduced-learned"> (rangement appris)</span>}
          </div>
        )}
        {showDeduced && (
          <>
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
        <label className="form-label" htmlFor="location">Emplacement</label>
        <div className="opt-grid">
          {LOCATIONS.map((l) => (
            <button
              key={l}
              type="button"
              className={`opt-btn${location === l ? ' active' : ''}`}
              onClick={() => userPickLocation(location === l ? '' : l)}
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
          onChange={(e) => userPickLocation(e.target.value)}
        />
      </div>

      {!nonFood && (
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
      )}

          </>
        )}
      </div>

      <div className="form-group deduced">
        <div className="deduced-head">
          <h2 className="form-group-title" style={{ margin: 0 }}>Achat</h2>
          <button type="button" className="deduced-toggle" onClick={() => setOpenBuy((v) => !v)}>
            {openBuy ? 'Replier' : 'Modifier'}
          </button>
        </div>
        {!openBuy && (
          <div className="deduced-summary">
            {shops.length || price.trim()
              ? [shops.join(', '), price.trim() ? `${price.trim().replace('.', ',')} €` : ''].filter(Boolean).join(' · ')
              : 'Non renseigné'}
          </div>
        )}
        {openBuy && (
          <>
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

          </>
        )}
      </div>

      <div className="form-footer">
        {isEdit && (
          <div className="form-actions">
            <button type="button" className="action-chip" onClick={handleConsume} aria-label="Consommer 1" title="Consommer 1">
              <Icon name="minus" width={2.2} />
            </button>
            <button type="button" className="action-chip danger" onClick={handleWaste} aria-label="Jeter" title="Jeter">
              <Icon name="recycle" width={2} />
            </button>
            <button type="button" className="action-chip danger" onClick={handleDelete} aria-label="Supprimer" title="Supprimer">
              <Icon name="trash" width={2} />
            </button>
          </div>
        )}
        <button className="btn-primary form-save" disabled={!canSave} onClick={handleSave}>
          <Icon name="check" width={2.4} />
          {isEdit ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}
