import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseUrl, getSupabaseAnonKey } from './config'

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey())
}
