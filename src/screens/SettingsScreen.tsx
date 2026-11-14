import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
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
  const { settings, updateSettings, resetDemo, refreshFromOFF } = useStore()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [push, setPush] = useState<PushState | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [stores, setStores] = useState<string[]>(() => getStores())
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [newStore, setNewStore] = useState('')
  const reloadStores = () => setStores(getStores())
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
    if (!confirm('Réinitialiser toutes les données avec le jeu de démonstration ?')) return
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
                ? "Ajoute d'abord Miamm à l'écran d'accueil (Partager, puis Sur l'écran d'accueil)"
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
                  onClick={() => {
                    if (window.confirm(`Supprimer ${st} de la liste ?`)) {
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
          Miamm · version 0.3
        </p>
      </div>
    </div>
  )
}
