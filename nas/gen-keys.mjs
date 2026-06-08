// Génère les secrets nécessaires à Supabase auto-hébergé.
// Usage : node nas/gen-keys.mjs
import { createHmac, randomBytes } from 'node:crypto'

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function jwt(payload, secret) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = b64url(createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

const now = Math.floor(Date.now() / 1000)
const tenYears = 60 * 60 * 24 * 365 * 10

const JWT_SECRET = randomBytes(32).toString('hex') // 64 chars
const POSTGRES_PASSWORD = randomBytes(18).toString('base64url')
const DASHBOARD_PASSWORD = randomBytes(12).toString('base64url')
const SECRET_KEY_BASE = randomBytes(32).toString('hex')
const VAULT_ENC_KEY = randomBytes(16).toString('hex') // 32 chars

const ANON_KEY = jwt({ role: 'anon', iss: 'supabase', iat: now, exp: now + tenYears }, JWT_SECRET)
const SERVICE_ROLE_KEY = jwt(
  { role: 'service_role', iss: 'supabase', iat: now, exp: now + tenYears },
  JWT_SECRET,
)

console.log(`# ===== Secrets Supabase générés — à reporter dans le .env =====
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SECRET_KEY_BASE=${SECRET_KEY_BASE}
VAULT_ENC_KEY=${VAULT_ENC_KEY}
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=${DASHBOARD_PASSWORD}

# ANON_KEY est publique (à mettre côté app dans VITE_SUPABASE_ANON_KEY).
# SERVICE_ROLE_KEY est SECRÈTE : ne jamais l'exposer côté navigateur.`)
