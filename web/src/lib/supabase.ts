import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type AuthConfig = {
  authEnabled: boolean
  supabaseUrl?: string
  supabaseAnonKey?: string
}

let authConfig: AuthConfig | null = null
let supabaseClient: SupabaseClient | null = null

export async function getAuthConfig(): Promise<AuthConfig> {
  if (authConfig) return authConfig

  try {
    const response = await fetch('/api/auth/config')
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const payload = await response.json() as {
      authEnabled: boolean
      supabaseUrl?: string | null
      supabaseAnonKey?: string | null
    }

    authConfig = {
      authEnabled: payload.authEnabled,
      supabaseUrl: payload.supabaseUrl ?? undefined,
      supabaseAnonKey: payload.supabaseAnonKey ?? undefined,
    }

    return authConfig
  } catch {
    return { authEnabled: false }
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
