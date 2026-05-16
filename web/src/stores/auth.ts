import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSupabase, getAuthConfig } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const loading = ref(false)
  const initialized = ref(false)
  const authEnabled = ref(false)

  // Deduplicates concurrent init() calls during page load / multi-navigation on refresh
  let initPromise: Promise<void> | null = null

  async function doInit() {
    const config = await getAuthConfig()
    authEnabled.value = config.authEnabled

    if (!config.authEnabled) {
      initialized.value = true
      return
    }

    const supabase = await getSupabase()
    if (!supabase) {
      initialized.value = true
      return
    }

    // Register onAuthStateChange BEFORE calling getSession() so we never miss
    // the INITIAL_SESSION event that Supabase fires when it restores the
    // localStorage session after a page refresh.  getSession() alone can
    // transiently return null while a background token-refresh is in flight.
    await new Promise<void>((resolve) => {
      supabase.auth.onAuthStateChange((event, s) => {
        if (s) {
          // Accept any valid session regardless of event type
          session.value = s
          user.value = s.user ?? null
        } else if (event === 'SIGNED_OUT') {
          // Only clear on explicit sign-out — other null-session events
          // (TOKEN_REFRESHED failure, internal lock timeout, etc.) must not
          // wipe a valid cached session.
          session.value = null
          user.value = null
        }
        // INITIAL_SESSION fires exactly once at startup
        if (event === 'INITIAL_SESSION') {
          resolve()
        }
      })
    })

    initialized.value = true
  }

  async function init() {
    if (initialized.value) return
    if (!initPromise) {
      initPromise = doInit().catch(() => {
        // Allow retry on next navigation if init failed (e.g. network error
        // during config fetch before the API server was ready)
        initPromise = null
      })
    }
    return initPromise
  }

  async function signIn(email: string, password: string): Promise<string | null> {
    const supabase = await getSupabase()
    if (!supabase) return 'Auth not configured'

    loading.value = true
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return error.message
      return null
    } finally {
      loading.value = false
    }
  }

  async function signOut() {
    const supabase = await getSupabase()
    if (supabase) {
      await supabase.auth.signOut()
    }
    user.value = null
    session.value = null
  }

  async function getAccessToken(): Promise<string | null> {
    const cached = session.value
    if (cached?.access_token) {
      // Proactively refresh when within 30 seconds of expiry
      if (cached.expires_at && cached.expires_at * 1000 - Date.now() < 30_000) {
        try {
          const supabase = await getSupabase()
          if (supabase) {
            const { data } = await supabase.auth.refreshSession()
            if (data.session) return data.session.access_token
          }
        } catch { /* fall through to cached token */ }
      }
      return cached.access_token
    }

    // No cached session — attempt recovery if auth is enabled.
    // Handles the edge case where the cache was spuriously cleared but a
    // valid refresh token still exists in localStorage.
    if (authEnabled.value) {
      try {
        const supabase = await getSupabase()
        if (supabase) {
          const { data } = await supabase.auth.refreshSession()
          if (data.session) return data.session.access_token
        }
      } catch { /* fall through to null */ }
    }

    return null
  }

  return { user, session, loading, initialized, authEnabled, init, signIn, signOut, getAccessToken }
})
