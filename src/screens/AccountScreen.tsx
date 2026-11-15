import { useEffect, useState } from 'react'
import { useAuth } from '../data/auth'
import { useStore } from '../data/store'
import { useToast } from '../components/Toast'
import { PageHeader } from '../components/PageHeader'
import { invokeFn, aiStatus, setAiKey, clearAiKey, isAdmin, allowedEmails, allowedStatus, type AllowedStatus, allowEmail, removeAllowedEmail, aiOverview, setHouseholdQuota, type AiStatus, type HouseholdQuota } from '../lib/aiKey'
import { useConfirm, usePrompt } from '../components/Confirm'

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
  const [myName, setMyName] = useState(auth.displayName)
  const [ai, setAi] = useState<AiStatus | null>(null)
  const [aiKey, setAiKeyField] = useState('')
  const askConfirm = useConfirm()
  const askPrompt = usePrompt()
  const [quotas, setQuotas] = useState<HouseholdQuota[]>([])
  const [admin, setAdmin] = useState(false)
  const [allowed, setAllowed] = useState<string[]>([])
  const [signups, setSignups] = useState<Record<string, string | null>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [newEmail, setNewEmail] = useState('')

  useEffect(() => {
    isAdmin().then((a) => {
      setAdmin(a)
      if (a) {
        allowedEmails().then(setAllowed).catch(() => {})
        allowedStatus().then(toSignupMap).then(setSignups).catch(() => {})
        aiOverview().then(setQuotas).catch(() => {})
      }
    })
  }, [auth.householdId])

  /** Envoie le vrai e-mail d'invitation (autorise aussi l'adresse côté serveur). */
  async function sendInvite(email: string) {
    setSending(email)
    try {
      const { error } = await invokeFn('invite', { email })
      if (error) throw error
      toast(`Invitation envoyée à ${email}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : "L'invitation n'a pas pu partir")
    } finally {
      setSending(null)
    }
  }

  async function addAllowed() {
    setBusy(true)
    try {
      const email = newEmail.trim().toLowerCase()
      await allowEmail(email)
      setNewEmail('')
      setAllowed(await allowedEmails())
      allowedStatus().then(toSignupMap).then(setSignups).catch(() => {})
      await sendInvite(email)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Ajout impossible')
    } finally {
      setBusy(false)
    }
  }

  async function editQuota(h: HouseholdQuota) {
    const v = await askPrompt({
      title: `Quota IA de « ${h.name} »`,
      defaultValue: h.quota < 0 ? '' : String(h.quota),
      placeholder: 'Appels par mois (0 = bloqué)',
      inputMode: 'numeric',
      confirmLabel: 'Enregistrer',
    })
    if (v === null) return
    const n = Math.floor(Number(v.trim()))
    if (v.trim() === '' || isNaN(n) || n < 0) return toast('Entre un nombre entier (0 ou plus)')
    try {
      await setHouseholdQuota(h.id, n)
      setQuotas(await aiOverview())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Modification impossible')
    }
  }

  async function quotaUnlimited(h: HouseholdQuota) {
    try {
      await setHouseholdQuota(h.id, -1)
      setQuotas(await aiOverview())
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Modification impossible')
    }
  }

  async function dropAllowed(email: string) {
    const ok = await askConfirm({
      title: "Retirer l'accès ?",
      message: `${email} ne pourra plus créer de compte. Un compte déjà créé reste actif.`,
      confirmLabel: 'Retirer',
      danger: true,
    })
    if (!ok) return
    try {
      await removeAllowedEmail(email)
      setAllowed(await allowedEmails())
      allowedStatus().then(toSignupMap).then(setSignups).catch(() => {})
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Suppression impossible')
    }
  }

  useEffect(() => {
    if (auth.householdId) aiStatus().then(setAi)
  }, [auth.householdId])

  async function saveAiKey() {
    setBusy(true)
    try {
      await setAiKey(aiKey)
      setAiKeyField('')
      setAi(await aiStatus())
      toast('Clé enregistrée : plus de limite mensuelle')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setBusy(false)
    }
  }

  async function removeAiKey() {
    setBusy(true)
    try {
      await clearAiKey()
      setAi(await aiStatus())
      toast('Clé retirée')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Suppression impossible')
    } finally {
      setBusy(false)
    }
  }

  // Synchronise le champ nom quand le profil est (re)chargé.
  useEffect(() => {
    setMyName(auth.displayName)
  }, [auth.displayName])

  async function shareInvite() {
    const text = `Je t'invite sur Miamm, l'appli pour gérer ton garde-manger (stock, dates de péremption, recettes, courses). Ouvre https://food.graphikeo.com, saisis ton adresse e-mail et entre le code reçu par e-mail (pense à regarder dans les indésirables). Choisis ensuite « Créer mon foyer » pour démarrer ton propre garde-manger.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Invitation à Miamm', text })
      } else {
        await navigator.clipboard?.writeText(text)
        toast('Invitation copiée')
      }
    } catch {
      /* partage annulé */
    }
  }

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
        <label className="form-label" htmlFor="myname">Mon nom (visible par le foyer)</label>
        <div className="form-row">
          <input
            id="myname"
            className="form-input"
            placeholder="Ex : Julien"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
          />
          <button
            className="btn-secondary"
            style={{ width: 'auto', padding: '0 16px' }}
            disabled={busy || myName.trim() === auth.displayName}
            onClick={async () => {
              setBusy(true)
              await auth.setDisplayName(myName)
              setBusy(false)
              toast('Nom enregistré')
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">Code d'invitation du foyer</label>
        <div className="setting-row" style={{ marginBottom: 12 }}>
          <div className="setting-text">
            <div className="setting-title" style={{ letterSpacing: 2, fontSize: 20 }}>
              {auth.inviteCode ?? '—'}
            </div>
            <div className="setting-desc">
              Partage ce code avec ta famille pour qu'ils rejoignent ce garde-manger.
            </div>
          </div>
        </div>
        <div className="btn-row">
          <button
            className="btn-secondary"
            onClick={() => {
              if (auth.inviteCode) navigator.clipboard?.writeText(auth.inviteCode)
              toast('Code copié')
            }}
          >
            Copier
          </button>
          <button className="btn-primary" onClick={shareInvite}>Partager</button>
        </div>
      </div>

      {admin && (
        <div className="form-section">
          <label className="form-label">Accès à l'appli (sur invitation)</label>
          <p className="setting-desc" style={{ marginBottom: 10 }}>
            Seules ces adresses peuvent créer un compte. Ajoute une personne avant de lui donner le lien.
          </p>
          {allowed.map((e) => (
            <div className="setting-row access-row" key={e}>
              <div className="access-text">
                <div className="access-email">{e}</div>
                {e.toLowerCase() in signups && (
                  signups[e.toLowerCase()]
                    ? <span className="access-badge ok">Inscrit le {new Date(signups[e.toLowerCase()]!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    : <span className="access-badge wait">Pas encore inscrit</span>
                )}
              </div>
              <div className="access-actions">
                <button className="btn-secondary store-edit-btn" disabled={sending === e} onClick={() => sendInvite(e)}>
                  {sending === e ? 'Envoi…' : 'Inviter'}
                </button>
                <button className="btn-secondary btn-danger store-edit-btn" onClick={() => dropAllowed(e)}>Retirer</button>
              </div>
            </div>
          ))}
          <input
            className="form-input"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            placeholder="adresse@exemple.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ marginTop: 8 }}
          />
          <button className="btn-secondary" style={{ marginTop: 8 }} disabled={busy || !newEmail.includes('@')} onClick={addAllowed}>
            Autoriser et envoyer l'invitation
          </button>
          <button className="access-share-link" onClick={() => shareInvite()}>
            Ou partager l'invitation par message (SMS, WhatsApp…)
          </button>
        </div>
      )}

      {admin && quotas.length > 0 && (
        <div className="form-section">
          <label className="form-label">Quotas IA par foyer (ce mois-ci)</label>
          {quotas.map((h) => (
            <div className="setting-row" key={h.id}>
              <div className="setting-text">
                <div className="setting-title" style={{ fontSize: 15 }}>{h.name}</div>
                <div className="setting-desc">
                  {h.members} membre{h.members > 1 ? 's' : ''} ·{' '}
                  {h.has_key
                    ? `clé perso (${h.used} appels)`
                    : h.quota < 0
                      ? `illimité (${h.used} appels)`
                      : `${h.used} / ${h.quota}${h.is_default ? ' (défaut)' : ''}`}
                </div>
              </div>
              {!h.has_key && (
                <>
                  <button className="btn-secondary store-edit-btn" onClick={() => editQuota(h)}>Modifier</button>
                  {h.quota >= 0 && (
                    <button className="btn-secondary store-edit-btn" onClick={() => quotaUnlimited(h)}>Illimité</button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {ai && (
        <div className="form-section">
          <label className="form-label">Intelligence artificielle</label>
          <p className="setting-desc" style={{ marginBottom: 10 }}>
            {ai.hasKey
              ? 'Ta propre clé Anthropic est utilisée : aucune limite mensuelle, les appels sont facturés sur ton compte Anthropic.'
              : ai.limit === null
                ? 'Utilisation illimitée.'
                : `${ai.used} / ${ai.limit} lectures IA utilisées ce mois-ci (scans de ticket, de recette, de prix et de date, recettes générées).`}
          </p>
          {ai.hasKey ? (
            <button className="btn-secondary btn-danger" disabled={busy} onClick={removeAiKey}>
              Retirer ma clé
            </button>
          ) : (
            <>
              <input
                className="form-input"
                type="password"
                autoComplete="off"
                placeholder="Ma clé Anthropic (sk-ant-…)"
                value={aiKey}
                onChange={(e) => setAiKeyField(e.target.value)}
              />
              <button className="btn-secondary" style={{ marginTop: 8 }} disabled={busy || !aiKey.trim()} onClick={saveAiKey}>
                Utiliser ma clé
              </button>
            </>
          )}
        </div>
      )}

      <div className="form-section">
        <label className="form-label">Membres du foyer ({auth.members.length})</label>
        {auth.members.map((m) => (
          <div className="setting-row" key={m.id}>
            <div className="setting-text">
              <div className="setting-title">
                {m.name}
                {m.id === auth.user?.id && <span className="member-you"> (toi)</span>}
              </div>
            </div>
          </div>
        ))}
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

function toSignupMap(rows: AllowedStatus[]): Record<string, string | null> {
  const m: Record<string, string | null> = {}
  for (const r of rows) m[r.email.toLowerCase()] = r.signedUpAt
  return m
}
