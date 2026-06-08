import { useState } from 'react'
import { useAuth } from '../data/auth'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'

interface AccountScreenProps {
  onBack: () => void
}

export function AccountScreen({ onBack }: AccountScreenProps) {
  const auth = useAuth()
  const store = useStore()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loginCode, setLoginCode] = useState('')
  const [busy, setBusy] = useState(false)

  if (!auth.cloudEnabled) {
    return (
      <div className="screen-fade">
        <PageHeader title="Compte" onBack={onBack} />
        <div className="form-section">
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            La synchronisation cloud n'est pas configurée sur cette version. Tes données sont
            enregistrées localement sur cet appareil.
          </p>
        </div>
      </div>
    )
  }

  async function sendLink() {
    if (!email.trim()) return
    setBusy(true)
    const { error } = await auth.signInWithEmail(email)
    setBusy(false)
    if (error) toast(error)
    else setSent(true)
  }

  async function verifyLoginCode() {
    if (loginCode.trim().length < 6) return
    setBusy(true)
    const { error } = await auth.verifyCode(email, loginCode)
    setBusy(false)
    if (error) toast(error)
    else toast('Connecté')
  }

  async function create() {
    setBusy(true)
    const { error } = await auth.createHousehold(name)
    setBusy(false)
    if (error) toast(error)
    else toast('Foyer créé')
  }

  async function join() {
    setBusy(true)
    const { error } = await auth.joinHousehold(code)
    setBusy(false)
    if (error) toast(error)
    else toast('Foyer rejoint')
  }

  // --- Non connecté ---
  if (!auth.user) {
    return (
      <div className="screen-fade">
        <PageHeader title="Connexion" onBack={onBack} />
        {sent ? (
          <div className="form-section">
            <div className="setting-row" style={{ marginBottom: 16 }}>
              <div className="setting-text">
                <div className="setting-title">Vérifie tes e-mails</div>
                <div className="setting-desc">
                  Un code à 6 chiffres a été envoyé à {email}. Saisis-le ci-dessous pour te connecter
                  (reste dans l'app, idéal depuis l'écran d'accueil).
                </div>
              </div>
            </div>
            <label className="form-label" htmlFor="logincode">Code reçu par e-mail</label>
            <input
              id="logincode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="form-input"
              placeholder="123456"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value.replace(/\D/g, ''))}
              style={{ marginBottom: 12, letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
            />
            <button
              className="btn-primary"
              disabled={busy || loginCode.trim().length < 6}
              onClick={verifyLoginCode}
              style={{ marginBottom: 12 }}
            >
              {busy ? 'Connexion…' : 'Se connecter'}
            </button>
            <button className="btn-secondary" onClick={() => { setSent(false); setLoginCode('') }}>
              Utiliser une autre adresse
            </button>
          </div>
        ) : (
          <div className="form-section">
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
              Connecte-toi pour partager ton garde-manger avec ta famille (synchronisé entre tous les
              appareils).
            </p>
            <label className="form-label" htmlFor="email">Adresse e-mail</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              className="form-input"
              placeholder="toi@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <button className="btn-primary" disabled={busy || !email.trim()} onClick={sendLink}>
              {busy ? 'Envoi…' : 'Recevoir mon code'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- Connecté sans foyer ---
  if (!auth.householdId) {
    return (
      <div className="screen-fade">
        <PageHeader title="Ton foyer" onBack={onBack} />
        <div className="form-section">
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Connecté en tant que <strong>{auth.user.email}</strong>. Crée un foyer ou rejoins celui de
            ta famille.
          </p>
        </div>
        <div className="form-section">
          <label className="form-label">Créer un foyer</label>
          <input
            className="form-input"
            placeholder="Nom du foyer (ex : Maison)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ marginBottom: 12 }}
          />
          <button className="btn-primary" disabled={busy} onClick={create}>
            Créer mon foyer
          </button>
        </div>
        <div className="form-section">
          <label className="form-label">Rejoindre un foyer</label>
          <input
            className="form-input"
            placeholder="Code d'invitation"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            style={{ marginBottom: 12 }}
          />
          <button className="btn-secondary" disabled={busy || !code.trim()} onClick={join}>
            Rejoindre avec le code
          </button>
        </div>
        <div className="form-section">
          <button className="btn-secondary btn-danger" onClick={auth.signOut}>
            Se déconnecter
          </button>
        </div>
      </div>
    )
  }

  // --- Connecté avec foyer ---
  return (
    <div className="screen-fade">
      <PageHeader title="Compte" onBack={onBack} />
      <div className="form-section">
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title">Connecté</div>
            <div className="setting-desc">{auth.user.email}</div>
          </div>
        </div>
      </div>
      <div className="form-section">
        <label className="form-label">Code d'invitation du foyer</label>
        <div className="setting-row">
          <div className="setting-text">
            <div className="setting-title" style={{ letterSpacing: 2, fontSize: 20 }}>
              {auth.inviteCode ?? '—'}
            </div>
            <div className="setting-desc">
              Partage ce code avec ta famille pour qu'ils rejoignent ce garde-manger.
            </div>
          </div>
          <button
            className="btn-secondary"
            style={{ width: 'auto', padding: '0 16px', height: 40 }}
            onClick={() => {
              if (auth.inviteCode) navigator.clipboard?.writeText(auth.inviteCode)
              toast('Code copié')
            }}
          >
            Copier
          </button>
        </div>
      </div>
      <div className="form-section">
        <label className="form-label">Données de cet appareil</label>
        <div className="setting-row" style={{ marginBottom: 12 }}>
          <div className="setting-text">
            <div className="setting-desc">
              Importe les produits et la liste de courses enregistrés localement sur cet appareil vers
              ce foyer cloud.
            </div>
          </div>
        </div>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const n = await store.importLocalData()
            setBusy(false)
            toast(n > 0 ? `${n} élément(s) importé(s)` : 'Rien à importer')
          }}
        >
          {busy ? 'Import…' : 'Importer les données de cet appareil'}
        </button>
      </div>

      <div className="form-section">
        <button className="btn-secondary btn-danger" onClick={auth.signOut}>
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
