import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null
let authConfig: { authEnabled: boolean; supabaseUrl: string | null; supabaseAnonKey: string | null } | null = null

export async function getAuthConfig() {
  if (authConfig) return authConfig
  try {
    const res = await fetch('/api/auth/config')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const config = await res.json() as { authEnabled: boolean; supabaseUrl: string | null; supabaseAnonKey: string | null }
    authConfig = config  // Only cache on success
    return authConfig
  } catch {
    // Return a safe default but don't cache — next call will retry
    return { authEnabled: false, supabaseUrl: null, supabaseAnonKey: null }
  }
}

export async function getSupabase(): Promise<SupabaseClient | null> {
  if (supabaseClient) return supabaseClient
  const config = await getAuthConfig()
  if (!config.authEnabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null
  }
  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return supabaseClient
}
