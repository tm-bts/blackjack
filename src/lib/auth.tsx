import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './supabase'
import type { Profile } from './supabase'
import type { Session } from '@supabase/supabase-js'

type AuthCtx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (error) {
      console.error('profile fetch error:', error)
    }
    if (data) {
      setProfile(data as Profile)
      return
    }
    // No profile yet — create one from signup metadata
    const meta = (user.user_metadata ?? {}) as { username?: string }
    let baseName = (meta.username ?? (user.email?.split('@')[0] ?? 'player')).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
    if (baseName.length < 3) baseName = `player${user.id.slice(0, 4)}`
    // Try a few variants in case of conflict
    for (let i = 0; i < 5; i++) {
      const candidate = i === 0 ? baseName : `${baseName}${Math.floor(Math.random() * 10000)}`
      const { data: inserted, error: insErr } = await supabase
        .from('profiles')
        .insert({ id: user.id, username: candidate, chips: 1000 })
        .select('*')
        .maybeSingle()
      if (!insErr) {
        setProfile(inserted as Profile)
        return
      }
      if (!String(insErr.message).toLowerCase().includes('duplicate') && insErr.code !== '23505') {
        console.error('profile insert error:', insErr)
        return
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      refreshProfile().finally(() => setLoading(false))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      refreshProfile()
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <Ctx.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export function useAuth() {
  return useContext(Ctx)
}
