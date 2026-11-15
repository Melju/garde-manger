import { useConfirm } from '../components/Confirm'
import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { addBrand, getCustomBrands, removeCustomBrand, renameCustomBrand } from '../lib/brands'
import { normalize } from '../lib/productIcon'
import { addStore, getStores, removeStore, renameStore } from '../lib/stores'
import { pushState, enablePush, disablePush, testPush, type PushState } from '../lib/push'

interface SettingsScreenProps {
  onBack: () => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  )
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { settings, updateSettings, resetDemo, refreshFromOFF, products, updateProduct } = useStore()
  const toast = useToast()
  const askConfirm = useConfirm()
  const [busy, setBusy] = useState(false)
  const [push, setPush] = useState<PushState | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [stores, setStores] = useState<string[]>(() => getStores())
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newStore, setNewStore] = useState('')
  const reloadStores = () => setStores(getStores())
  // Marques : celles des produits + celles ajoutées à la main.
  const [brandTick, setBrandTick] = useState(0)
  const [editingBrand, setEditingBrand] = useState<string | null>(null)
  const [brandDraft, setBrandDraft] = useState('')
  const [newBrand, setNewBrand] = useState('')
  const brandList = (() => {
    void brandTick
    const m = new Map<string, { label: string; n: number }>()
    for (const p of products) {
      const b = p.brand?.trim()
      if (b) m.set(normalize(b), { label: b, n: (m.get(normalize(b))?.n ?? 0) + 1 })
    }
    for (const b of getCustomBrands()) if (!m.has(normalize(b))) m.set(normalize(b), { label: b, n: 0 })
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label))
  })()
  async function saveBrandEdit() {
    const from = editingBrand
    const to = brandDraft.trim()
    setEditingBrand(null)
    if (!from || !to || to === from) return
    renameCustomBrand(from, to)
    for (const p of products) if (p.brand && normalize(p.brand) === normalize(from)) await updateProduct(p.id, { brand: to })
    setBrandTick((t) => t + 1)
  }
  async function deleteBrand(b: string, n: number) {
    if (!(await askConfirm({ title: `Supprimer ${b} ?`, message: n ? `La marque sera retirée de ${n} produit${n > 1 ? 's' : ''}. Les produits restent.` : undefined, confirmLabel: 'Supprimer', danger: true }))) return
    removeCustomBrand(b)
    for (const p of products) if (p.brand && normalize(p.brand) === normalize(b)) await updateProduct(p.id, { brand: undefined })
    setBrandTick((t) => t + 1)
  }
  function saveEdit() {
    if (editing && draft.trim()) renameStore(editing, draft)
    setEditing(null)
    reloadStores()
  }
  useEffect(() => {
    pushState().then(setPush).catch(() => setPush('unsupported'))
  }, [])

  async function togglePush(on: boolean) {
    setPushBusy(true)
    try {
      if (on) {
        await enablePush()
        toast('Alerte quotidienne activée')
      } else {
        await disablePush()
        toast('Alerte quotidienne désactivée')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Échec')
    } finally {
      setPush(await pushState().catch(() => 'unsupported' as PushState))
      setPushBusy(false)
    }
  }

  async function refresh() {
    setBusy(true)
    const { updated, scanned } = await refreshFromOFF()
    setBusy(false)
    if (scanned === 0) toast('Aucun produit avec code-barres à compléter')
    else toast(`${updated} produit(s) complété(s) sur ${scanned}`)
  }

  async function reset() {
    if (!(await askConfirm({ title: 'Réinitialiser les données ?', message: 'Toutes les données seront remplacées par le jeu de démonstration.', confirmLabel: 'Réinitialiser', danger: true }))) return
    await resetDemo()
    toast('Données réinitialisées')
    onBack()
  }

  return (
    <div className="screen-fade">
      <PageHeader title="Paramètres" onBack={onBack} />

      <div className="form-section">
        <label className="form-label">Notifications</label>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Alertes de péremption</div>
            <div className="setting-desc">Produits qui périment bientôt</div>
          </div>
          <Toggle checked={settings.notifExpiry} onChange={(v) => updateSettings({ notifExpiry: v })} />
        </div>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Alertes de stock bas</div>
            <div className="setting-desc">
              Quand la quantité est ≤ {settings.lowStockThreshold}
            </div>
          </div>
          <Toggle checked={settings.notifLowStock} onChange={(v) => updateSettings({ notifLowStock: v })} />
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Sur ce téléphone</label>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Alerte chaque matin</div>
            <div className="setting-desc">
              {push === 'needs-install'
                ? "Ajoute d'abord Miam miam à l'écran d'accueil (Partager, puis Sur l'écran d'accueil)"
                : push === 'denied'
                  ? "Bloquées : autorise les notifications dans les réglages du téléphone"
                  : push === 'unsupported'
                    ? 'Indisponible sur cet appareil ou hors compte'
                    : 'Un résumé des produits à consommer vite, une fois par jour'}
            </div>
          </div>
          <Toggle
            checked={push === 'on'}
            onChange={(v) => !pushBusy && (push === 'on' || push === 'off') && togglePush(v)}
          />
        </div>
        {push === 'on' && (
          <button className="btn-secondary" onClick={() => testPush().catch(() => toast('Test impossible'))} style={{ marginTop: 10 }}>
            Envoyer une notification test
          </button>
        )}
      </div>

      <div className="form-section">
        <label className="form-label">Seuil de stock bas</label>
        <div className="qty-stepper">
          <button
            type="button"
            onClick={() => updateSettings({ lowStockThreshold: Math.max(0, settings.lowStockThreshold - 1) })}
            aria-label="Diminuer"
          >
            −
          </button>
          <input type="number" value={settings.lowStockThreshold} readOnly />
          <button
            type="button"
            onClick={() => updateSettings({ lowStockThreshold: settings.lowStockThreshold + 1 })}
            aria-label="Augmenter"
          >
            +
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Mes magasins</label>
        {stores.map((st) => (
          <div className="setting-row store-edit-row" key={st}>
            {editing === st ? (
              <>
                <input
                  className="store-edit-input"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                />
                <button className="btn-secondary store-edit-btn" onClick={saveEdit}>OK</button>
              </>
            ) : (
              <>
                <div className="setting-text"><div className="setting-title">{st}</div></div>
                <button className="btn-secondary store-edit-btn" onClick={() => { setEditing(st); setDraft(st) }}>Renommer</button>
                <button
                  className="btn-secondary btn-danger store-edit-btn"
                  onClick={async () => {
                    if (await askConfirm({ title: `Supprimer ${st} ?`, message: 'Le magasin et ses habitudes d’achat seront retirés.', confirmLabel: 'Supprimer', danger: true })) {
                      removeStore(st)
                      reloadStores()
                    }
                  }}
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        ))}
        <div className="store-new" style={{ marginTop: 10 }}>
          <input
            className="form-input"
            placeholder="Nouveau magasin"
            value={newStore}
            onChange={(e) => setNewStore(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newStore.trim()) {
                addStore(newStore)
                setNewStore('')
                reloadStores()
              }
            }}
          />
          <button
            className="btn-secondary"
            disabled={!newStore.trim()}
            onClick={() => {
              addStore(newStore)
              setNewStore('')
              reloadStores()
            }}
          >
            +
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Mes marques</label>
        {brandList.length === 0 && <div className="setting-desc">Aucune marque pour l'instant.</div>}
        {brandList.map((b) => (
          <div className="setting-row store-edit-row" key={b.label}>
            {editingBrand === b.label ? (
              <>
                <input
                  className="store-edit-input"
                  value={brandDraft}
                  autoFocus
                  onChange={(e) => setBrandDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveBrandEdit()}
                />
                <button className="btn-secondary store-edit-btn" onClick={saveBrandEdit}>OK</button>
              </>
            ) : (
              <>
                <div className="setting-text">
                  <div className="setting-title">{b.label}</div>
                  <div className="setting-desc">{b.n ? `${b.n} produit${b.n > 1 ? 's' : ''}` : 'Aucun produit'}</div>
                </div>
                <button className="btn-secondary store-edit-btn" onClick={() => { setEditingBrand(b.label); setBrandDraft(b.label) }}>Renommer</button>
                <button className="btn-secondary btn-danger store-edit-btn" onClick={() => deleteBrand(b.label, b.n)}>Supprimer</button>
              </>
            )}
          </div>
        ))}
        <div className="store-new" style={{ marginTop: 10 }}>
          <input
            className="form-input"
            placeholder="Nouvelle marque"
            value={newBrand}
            onChange={(e) => setNewBrand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newBrand.trim()) {
                addBrand(newBrand)
                setNewBrand('')
                setBrandTick((t) => t + 1)
              }
            }}
          />
          <button
            className="btn-secondary"
            disabled={!newBrand.trim()}
            onClick={() => {
              addBrand(newBrand)
              setNewBrand('')
              setBrandTick((t) => t + 1)
            }}
          >
            +
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Données</label>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Stockage local</div>
            <div className="setting-desc">
              Vos données sont enregistrées dans ce navigateur (hors-ligne).
            </div>
          </div>
        </div>
        <button className="btn-secondary" disabled={busy} onClick={refresh} style={{ marginBottom: 12 }}>
          {busy ? 'Mise à jour…' : 'Compléter les infos produits (Open Food Facts)'}
        </button>
        <button className="btn-secondary btn-danger" onClick={reset}>
          Réinitialiser les données démo
        </button>
      </div>

      <div className="form-section">
        <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
          Miam miam · version 0.3
        </p>
      </div>
    </div>
  )
}
