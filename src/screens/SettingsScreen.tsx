import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'

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
  const { settings, updateSettings, resetDemo } = useStore()
  const toast = useToast()

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
        <label className="form-label">Données</label>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Stockage local</div>
            <div className="setting-desc">
              Vos données sont enregistrées dans ce navigateur (hors-ligne).
            </div>
          </div>
        </div>
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
