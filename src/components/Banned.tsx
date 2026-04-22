import { useAuth } from '../lib/auth'
import { SITE_NAME } from '../lib/supabase'

export function Banned() {
  const { signOut } = useAuth()
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1 className="brand">{SITE_NAME}</h1>
        <p className="tagline">Account suspended</p>
        <p className="fine" style={{ marginTop: 20 }}>
          Your account has been banned. If you think this is a mistake, contact the admin.
        </p>
        <button className="ghost" style={{ width: '100%', marginTop: 16 }} onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
