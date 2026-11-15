// Edge Function « invite » : l'administrateur invite une adresse e-mail.
// 1) vérifie que l'appelant est connecté et administrateur,
// 2) autorise l'adresse (allowed_emails),
// 3) envoie un vrai e-mail d'invitation via l'API Resend.
// La clé Resend est lue dans la table privée app_secrets avec la clé service (jamais exposée au client).

const BASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = 'Miam miam <garde-manger@graphikeo.com>'
const APP_URL = 'https://food.graphikeo.com'

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } })
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function emailHtml(inviter: string, to: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;background:#eef2f1;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1b2733;">
  <div style="max-width:460px;margin:0 auto;padding:32px 24px;">
    <img src="${APP_URL}/logo.png" alt="Miam miam" width="150" style="display:block;width:150px;height:auto;margin:0 0 16px;" />
    <h1 style="font-size:20px;margin:0 0 14px;">Tu es invité(e) sur Miam miam</h1>
    <p style="font-size:15px;line-height:1.55;margin:0 0 14px;color:#48596b;">
      ${esc(inviter)} t'invite à utiliser Miam miam, l'appli pour gérer ton garde-manger :
      ton stock, les dates de péremption, des idées de recettes et ta liste de courses.
    </p>
    <p style="font-size:15px;line-height:1.55;margin:0 0 22px;color:#48596b;">
      Ton accès est prêt pour l'adresse <strong>${esc(to)}</strong>.
    </p>
    <a href="${APP_URL}" style="display:inline-block;background:#0c8fa0;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:12px;">Créer mon garde-manger</a>
    <ol style="font-size:14px;line-height:1.6;margin:24px 0 0;padding-left:20px;color:#48596b;">
      <li>Ouvre l'appli et saisis cette adresse e-mail.</li>
      <li>Entre le code à 6 chiffres que tu reçois ensuite par e-mail.</li>
      <li>Choisis « Créer mon foyer » : ton garde-manger est prêt.</li>
    </ol>
    <p style="font-size:13px;line-height:1.5;margin:22px 0 0;color:#7a8a99;">
      Astuce : sur téléphone, ajoute l'appli à ton écran d'accueil pour l'ouvrir comme une vraie application.
      Si tu ne t'attendais pas à cette invitation, ignore simplement cet e-mail.
    </p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)
  const h = req.headers.get('authorization') ?? ''
  const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
  if (!token) return json({ error: 'Connexion requise' }, 401)

  let body: { email?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    /* corps vide */
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Adresse e-mail invalide' }, 400)

  // Appelant : session valide + administrateur
  const userRes = await fetch(`${BASE_URL}/auth/v1/user`, { headers: { apikey: ANON, authorization: `Bearer ${token}` } })
  if (!userRes.ok) return json({ error: 'Session invalide : reconnecte-toi' }, 401)
  const user = await userRes.json()
  const rpc = (fn: string, args: unknown) =>
    fetch(`${BASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(args),
    })
  const adm = await rpc('is_admin', {})
  if (!adm.ok || (await adm.json()) !== true) return json({ error: "Réservé à l'administrateur" }, 403)

  // Autorise l'adresse (idempotent)
  const allow = await rpc('admin_allow_email', { p_email: email })
  if (!allow.ok) {
    const t = await allow.text()
    return json({ error: `Autorisation impossible : ${t.slice(0, 200)}` }, 500)
  }

  // Clé Resend depuis la table privée
  const sec = await fetch(`${BASE_URL}/rest/v1/app_secrets?name=eq.resend_api_key&select=value`, {
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}` },
  })
  const rows = sec.ok ? await sec.json() : []
  const key = rows?.[0]?.value
  if (!key) return json({ error: "Envoi d'e-mail non configuré sur le serveur" }, 500)

  const inviter = (user?.email as string) ?? 'Quelqu’un'
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      reply_to: inviter,
      subject: 'Tu es invité(e) sur Miam miam',
      html: emailHtml(inviter, email),
      text: `${inviter} t'invite sur Miam miam, l'appli pour gérer ton garde-manger.\n\n1) Ouvre ${APP_URL} et saisis ${email}.\n2) Entre le code à 6 chiffres reçu par e-mail.\n3) Choisis « Créer mon foyer ».`,
    }),
  })
  if (!send.ok) {
    const t = await send.text()
    return json({ error: `L'e-mail n'a pas pu partir : ${t.slice(0, 200)}` }, 502)
  }
  const out = await send.json().catch(() => ({}))
  return json({ ok: true, id: out?.id ?? null })
})
