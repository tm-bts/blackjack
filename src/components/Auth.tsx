import { useState } from 'react'
import { supabase, SITE_NAME } from '../lib/supabase'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const cleanName = username.trim()
        if (cleanName.length < 3 || cleanName.length > 20) throw new Error('Username 3–20 chars')
        if (!/^[a-zA-Z0-9_]+$/.test(cleanName)) throw new Error('Username letters/numbers/_ only')
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: cleanName } },
        })
        if (error) throw error
        if (!data.session) {
          setInfo('Check your email to confirm, then log in.')
          setMode('login')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: unknown }).message)
            : JSON.stringify(e)
      setErr(msg)
      console.error('auth error:', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="brand">{SITE_NAME}</h1>
        <p className="tagline">Sit down. Place your bet.</p>
        <div className="tabs">
          <button className={mode === 'login' ? 'tab on' : 'tab'} onClick={() => setMode('login')}>Log in</button>
          <button className={mode === 'signup' ? 'tab on' : 'tab'} onClick={() => setMode('signup')}>Sign up</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && (
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              required
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={6}
          />
          <button className="primary" type="submit" disabled={busy}>
            {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>
        {err && <div className="err">{err}</div>}
        {info && <div className="info">{info}</div>}
        <p className="fine">Starts you off with 1,000 chips. +500 daily bonus. Purely for fun.</p>
      </div>
    </div>
  )
}
