import { supabase } from '../data/supabaseClient'

export interface AiStatus {
  hasKey: boolean
  used: number
  /** null = illimité */
  limit: number | null
}

export async function aiStatus(): Promise<AiStatus | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('ai_status')
  if (error || !data) return null
  return data as AiStatus
}

export async function setAiKey(key: string): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi')
  const { error } = await supabase.rpc('set_ai_key', { p_key: key.trim() })
  if (error) throw new Error(error.message)
}

export async function clearAiKey(): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi')
  const { error } = await supabase.rpc('clear_ai_key')
  if (error) throw new Error(error.message)
}

/** Appelle une edge function et remonte le vrai message d'erreur (quota, clé refusée…). */
export async function invokeFn(name: string, body: unknown): Promise<{ data: unknown; error: Error | null }> {
  if (!supabase) return { data: null, error: new Error('Non connecté') }
  const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown> })
  if (!error) return { data, error: null }
  let msg = error.message
  try {
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const j = await ctx.json()
      if (j?.error) msg = String(j.error)
    }
  } catch {
    /* garde le message générique */
  }
  return { data, error: new Error(msg) }
}

// ----- Administration des accès (inscription sur invitation) -----

export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.rpc('is_admin')
  return data === true
}

export async function allowedEmails(): Promise<string[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_allowed_list')
  if (error) throw new Error(error.message)
  return (data ?? []) as string[]
}

export async function allowEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi')
  const { error } = await supabase.rpc('admin_allow_email', { p_email: email })
  if (error) throw new Error(error.message)
}

export async function removeAllowedEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi')
  const { error } = await supabase.rpc('admin_remove_email', { p_email: email })
  if (error) throw new Error(error.message)
}

// ----- Quotas IA par foyer (administrateur) -----

export interface HouseholdQuota {
  id: string
  name: string
  members: number
  used: number
  /** -1 = illimité */
  quota: number
  has_key: boolean
  is_default: boolean
}

export async function aiOverview(): Promise<HouseholdQuota[]> {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_ai_overview')
  if (error) throw new Error(error.message)
  return (data ?? []) as HouseholdQuota[]
}

/** quota : nombre par mois, -1 = illimité, null = défaut. */
export async function setHouseholdQuota(id: string, quota: number | null): Promise<void> {
  if (!supabase) throw new Error('Connecte-toi')
  const { error } = await supabase.rpc('admin_set_quota', { p_household: id, p_quota: quota })
  if (error) throw new Error(error.message)
}
