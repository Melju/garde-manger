import { supabase, supabaseEnabled } from '../data/supabaseClient'

/** Clé publique VAPID (publique par conception). La clé privée n'existe que côté serveur. */
const VAPID_PUBLIC_KEY = 'BOzDhrZJZlDKjkUwYGAU547ySMAjz1IdBhsbs3YdxFxY0jOej6J4HGKTKioVJAno2dLOfpONFkpBE32sPNMZU_s'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`))
}

/** État des notifications push sur cet appareil. */
export async function pushState(): Promise<PushState> {
  if (!supabaseEnabled) return 'unsupported'
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Demande l'autorisation, abonne l'appareil et enregistre l'abonnement pour le foyer. */
export async function enablePush(): Promise<void> {
  if (!supabase) throw new Error('Compte requis')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Autorisation refusée')
  const reg = await registration()
  if (!reg) throw new Error('Notifications non prises en charge')
  await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) }))
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Abonnement incomplet')
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, { onConflict: 'endpoint' })
  if (error) throw new Error(error.message.includes('push_subscriptions') ? 'Table des abonnements absente (voir supabase/push.sql)' : error.message)
}

/** Désabonne l'appareil et supprime l'abonnement côté serveur. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

/** Notification locale de test (vérifie l'autorisation et le service worker, sans passer par le serveur). */
export async function testPush(): Promise<void> {
  const reg = await registration()
  await reg?.showNotification('Miamm', { body: 'Les notifications fonctionnent sur cet appareil.', icon: './icon-192.png', tag: 'miamm-test' })
}
