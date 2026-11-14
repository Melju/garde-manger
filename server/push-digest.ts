// Fonction Vercel (cron quotidien) : envoie le résumé « à consommer vite » aux téléphones abonnés.
// Source de api/push-digest.js (généré par `npm run build:api`, ne pas éditer le fichier généré).
import webpush from 'web-push'
import type { Product, Settings } from '../src/types'
import { buildDigest } from '../src/lib/pushDigest'

interface Row {
  household_id: string
  subs: { endpoint: string; p256dh: string; auth: string }[]
  settings: { notif_expiry?: boolean; notif_low_stock?: boolean; low_stock_threshold?: number } | null
  products: Record<string, unknown>[]
}

const env = (k: string) => process.env[k] ?? ''

async function rpc<T>(fn: string, body: unknown): Promise<T> {
  const base = env('VITE_SUPABASE_URL') || env('SUPABASE_URL')
  const anon = env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY')
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return (await r.json()) as T
}

export default async function handler(req: any, res: any) {
  const cron = env('CRON_SECRET')
  if (!cron || req.headers?.authorization !== `Bearer ${cron}`) return res.status(401).json({ error: 'unauthorized' })
  if (!env('VAPID_PRIVATE_KEY') || !env('VAPID_PUBLIC_KEY') || !env('PUSH_SECRET')) return res.status(500).json({ error: 'config manquante' })

  webpush.setVapidDetails(env('VAPID_SUBJECT') || 'https://food.graphikeo.com', env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'))

  const rows = await rpc<Row[]>('push_pending', { p_secret: env('PUSH_SECRET') })
  let sent = 0, removed = 0, skipped = 0, failed = 0
  for (const row of rows) {
    const settings: Settings = {
      notifExpiry: row.settings?.notif_expiry ?? true,
      notifLowStock: row.settings?.notif_low_stock ?? true,
      lowStockThreshold: row.settings?.low_stock_threshold ?? 1,
    }
    const products = row.products.map((r) => ({
      id: String(r.id), name: String(r.name), category: r.category, quantity: Number(r.quantity),
      unit: r.unit ?? undefined, size: r.size ?? undefined, expiryDate: r.expiry_date ?? undefined,
      dateType: r.date_type ?? undefined, location: r.location ?? undefined, conservation: r.conservation ?? undefined,
    })) as unknown as Product[]
    const digest = buildDigest(products, settings)
    if (!digest) { skipped++; continue }
    const payload = JSON.stringify({ ...digest, tag: 'miamm-digest', url: './' })
    for (const s of row.subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
        sent++
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          removed++
          await rpc('push_forget', { p_secret: env('PUSH_SECRET'), p_endpoint: s.endpoint }).catch(() => {})
        } else failed++
      }
    }
  }
  return res.status(200).json({ households: rows.length, sent, removed, skipped, failed })
}
