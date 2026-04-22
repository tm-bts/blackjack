import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export function Leaderboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Profile[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .order('chips', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        else setRows((data as Profile[]) ?? [])
      })
  }, [])

  if (err) return <div className="loading err">Error: {err}</div>
  if (!rows) return <div className="loading">Counting chips…</div>

  return (
    <div className="leaderboard">
      <h2>Leaderboard</h2>
      <table>
        <thead>
          <tr><th>#</th><th>player</th><th>chips</th><th>hands</th><th>win %</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const pct = r.hands_played > 0 ? Math.round((r.hands_won / r.hands_played) * 100) : 0
            const me = profile?.id === r.id
            return (
              <tr key={r.id} className={me ? 'me' : ''}>
                <td>{i + 1}</td>
                <td>{r.username}{me ? ' (you)' : ''}</td>
                <td>{r.chips.toLocaleString()}</td>
                <td>{r.hands_played}</td>
                <td>{pct}%</td>
              </tr>
            )
          })}
          {rows.length === 0 && <tr><td colSpan={5}>No players yet. Be the first.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
