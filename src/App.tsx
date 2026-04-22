import { HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { Auth } from './components/Auth'
import { Header } from './components/Header'
import { Game } from './components/Game'
import { Leaderboard } from './components/Leaderboard'
import { Admin } from './components/Admin'
import { Banned } from './components/Banned'
import './App.css'

function Gate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="loading">Shuffling…</div>
  if (!session) return <Auth />
  if (!profile) return <div className="loading">Finding your seat…</div>
  if (profile.banned) return <Banned />
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          {profile.is_admin && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Game />} />
        </Routes>
      </main>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </AuthProvider>
  )
}
