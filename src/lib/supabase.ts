import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_KEY as string

export const supabase = createClient(url, key)

export const SITE_NAME = (import.meta.env.VITE_SITE_NAME as string) || 'Blackjack'

export type Profile = {
  id: string
  username: string
  chips: number
  hands_played: number
  hands_won: number
  last_bonus_at: string | null
  created_at: string
}
