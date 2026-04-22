import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { SITE_NAME } from '../lib/supabase'

export function Header() {
  const { profile, signOut } = useAuth()
  return (
    <header className="site-header">
      <div className="brand-row">
        <NavLink to="/" className="brand-link">{SITE_NAME}</NavLink>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'on' : '')}>Table</NavLink>
          <NavLink to="/leaderboard" className={({ isActive }) => (isActive ? 'on' : '')}>Leaderboard</NavLink>
        </nav>
      </div>
      <div className="user-row">
        {profile && (
          <>
            <span className="uname">{profile.username}</span>
            <span className="chips">🪙 {profile.chips.toLocaleString()}</span>
            <button className="ghost" onClick={signOut}>Sign out</button>
          </>
        )}
      </div>
    </header>
  )
}
