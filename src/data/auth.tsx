import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseEnabled } from './supabaseClient'

interface AuthValue {
  /** true quand l'état initial est chargé. */
  ready: boolean
  /** Le backend cloud est-il configuré ? */
  cloudEnabled: boolean
  session: Session | null
  user: User | null
  /** Foyer de l'utilisateur (null s'il n'en a pas encore). */
  householdId: string | null
  inviteCode: string | null
  /** Membres du foyer (profils). */
  members: { id: string; name: string }[]
  /** Nom affiché de l'utilisateur courant. */
  displayName: string
  setDisplayName(name: string): Promise<void>
  /** Envoie un e-mail contenant un code (et un lien) de connexion. */
  signInWithEmail(email: string): Promise<{ error?: string }>
  /** Valide le code à 6 chiffres reçu par e-mail (reste dans l'app / la PWA). */
  verifyCode(email: string, token: string): Promise<{ error?: string }>
  signOut(): Promise<void>
  createHousehold(name: string): Promise<{ error?: string }>
  joinHousehold(code: string): Promise<{ error?: string }>
  refreshHousehold(): Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const REDIRECT_URL =
  typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseEnabled)
  const [session, setSession] = useState<Session | null>(null)
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [displayName, setDisplayNameState] = useState('')

  const loadHousehold = useCallback(async (uid: string | undefined) => {
    if (!supabase || !uid) {
      setHouseholdId(null)
      setInviteCode(null)
      setMembers([])
      setDisplayNameState('')
      return
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id, display_name')
      .eq('id', uid)
      .maybeSingle()
    setDisplayNameState(profile?.display_name ?? '')
    const hid = profile?.household_id ?? null
    setHouseholdId(hid)
    if (hid) {
      const { data: h } = await supabase
        .from('households')
        .select('invite_code')
        .eq('id', hid)
        .maybeSingle()
      setInviteCode(h?.invite_code ?? null)
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', hid)
      setMembers((profs ?? []).map((p: any) => ({ id: p.id, name: p.display_name || 'Membre' })))
    } else {
      setInviteCode(null)
      setMembers([])
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadHousehold(data.session?.user?.id)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      setSession(s)
      await loadHousehold(s?.user?.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadHousehold])

  const value: AuthValue = {
    ready,
    cloudEnabled: supabaseEnabled,
    session,
    user: session?.user ?? null,
    householdId,
    inviteCode,
    members,
    displayName,
    async setDisplayName(name) {
      if (!supabase || !session?.user?.id) return
      await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id)
      await loadHousehold(session.user.id)
    },
    async signInWithEmail(email) {
      if (!supabase) return { error: 'Cloud non configuré' }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: REDIRECT_URL, shouldCreateUser: true },
      })
      return error ? { error: error.message } : {}
    },
    async verifyCode(email, token) {
      if (!supabase) return { error: 'Cloud non configuré' }
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'email',
      })
      return error ? { error: error.message } : {}
    },
    async signOut() {
      await supabase?.auth.signOut()
      setHouseholdId(null)
      setInviteCode(null)
    },
    async createHousehold(name) {
      if (!supabase) return { error: 'Cloud non configuré' }
      const { error } = await supabase.rpc('create_household', { p_name: name })
      if (error) return { error: error.message }
      await loadHousehold(session?.user?.id)
      return {}
    },
    async joinHousehold(code) {
      if (!supabase) return { error: 'Cloud non configuré' }
      const { error } = await supabase.rpc('join_household', { p_code: code })
      if (error) return { error: error.message }
      await loadHousehold(session?.user?.id)
      return {}
    },
    async refreshHousehold() {
      await loadHousehold(session?.user?.id)
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans un <AuthProvider>')
  return ctx
}
