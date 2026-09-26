export const DEFAULT_SUPABASE_URL = 'https://usokowerssgsjavawdvi.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzb2tvd2Vyc3Nnc2phdmF3ZHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMjc3OTQsImV4cCI6MjEwNDgwMzc5NH0.fIFnNYp5KbZSRyOU-brbpazHSpErWK5XLoouOBTuomw'

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
