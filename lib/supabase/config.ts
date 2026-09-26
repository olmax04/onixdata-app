export const DEFAULT_SUPABASE_URL = 'https://aphurfmggtnfvfxadzqb.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_l8pVtMzkm0fhe0qpo2E9Lw_xHuPl9-9'

export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl()
  const key = getSupabaseAnonKey()
  return Boolean(url && key && key !== 'public-anon-key')
}
