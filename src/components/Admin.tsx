import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export function Admin() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('chips', { ascending: false })
    if (error) setErr(error.message)
    else setRows((data as Profile[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  if (!profile?.is_admin) {
    return <div className="loading">Not authorized.</div>
  }
  if (err) return <div className="loading err">Error: {err}</div>
  if (!rows) return <div className="loading">Loading…</div>

  async function update(id: string, patch: Partial<Profile>, label: string) {
    setBusy(id + label)
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    setBusy(null)
    if (error) return alert(error.message)
    await load()
  }

  async function giveChips(p: Profile) {
    const raw = prompt(`Give how many chips to ${p.username}? (negative to take away)`, '1000')
    if (raw === null) return
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n)) return alert('Invalid number')
    await update(p.id, { chips: Math.max(0, p.chips + n) }, 'give')
  }

  async function resetChips(p: Profile) {
    const raw = prompt(`Reset ${p.username}'s chips to:`, '1000')
    if (raw === null) return
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) return alert('Invalid number')
    await update(p.id, { chips: n }, 'reset')
  }

  async function toggleBan(p: Profile) {
    if (!confirm(`${p.banned ? 'Unban' : 'Ban'} ${p.username}?`)) return
    await update(p.id, { banned: !p.banned }, 'ban')
  }

  return (
    <div className="leaderboard">
      <h2>Admin Panel</h2>
      <p className="fine" style={{ textAlign: 'left', margin: '0 0 16px' }}>
        Logged in as <b>{profile.username}</b> (admin)
      </p>
      <table>
        <thead>
          <tr>
            <th>player</th>
            <th>chips</th>
            <th>hands</th>
            <th>status</th>
            <th>actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const me = r.id === profile.id
            return (
              <tr key={r.id} className={me ? 'me' : ''}>
                <td>
                  {r.username}
                  {r.is_admin && <span className="badge admin-badge">ADMIN</span>}
                  {me && ' (you)'}
                </td>
                <td>{r.chips.toLocaleString()}</td>
                <td>{r.hands_played}</td>
                <td>{r.banned ? <span className="badge ban-badge">BANNED</span> : 'ok'}</td>
                <td className="admin-actions">
                  <button disabled={busy === r.id + 'give'} onClick={() => giveChips(r)}>+/- chips</button>
                  <button disabled={busy === r.id + 'reset'} onClick={() => resetChips(r)}>Reset</button>
                  <button
                    disabled={busy === r.id + 'ban' || r.is_admin}
                    onClick={() => toggleBan(r)}
                  >
                    {r.banned ? 'Unban' : 'Ban'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
