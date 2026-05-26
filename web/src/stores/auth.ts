import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { Session, User } from '@supabase/supabase-js'
import { getAuthConfig, getSupabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const initialized = ref(false)
  const authEnabled = ref(false)
  const loading = ref(false)
  const isAuthenticated = computed(() => !authEnabled.value || !!user.value)

  let listening = false

  async function syncSession() {
    const supabase = await getSupabase()
    if (!supabase) {
      session.value = null
      user.value = null
      return
    }

    const { data } = await supabase.auth.getSession()
    session.value = data.session ?? null
    user.value = data.session?.user ?? null
  }

  async function init(force = false) {
    if (initialized.value && !force) return

    loading.value = true
    const config = await getAuthConfig()
    authEnabled.value = !!config.authEnabled

    if (!authEnabled.value) {
      initialized.value = true
      loading.value = false
      return
    }

    await syncSession()

    const supabase = await getSupabase()
    if (supabase && !listening) {
      supabase.auth.onAuthStateChange((_event, nextSession) => {
        session.value = nextSession
        user.value = nextSession?.user ?? null
        initialized.value = true
      })
      listening = true
    }

    initialized.value = true
    loading.value = false
  }

  async function signIn(email: string, password: string) {
    loading.value = true

    try {
      const supabase = await getSupabase()
      if (!supabase) {
        throw new Error('Authentication is disabled for this workspace.')
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      await syncSession()
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  async function signOut() {
    if (!authEnabled.value) {
      user.value = null
      session.value = null
      return
    }

    const supabase = await getSupabase()
    await supabase?.auth.signOut()
    user.value = null
    session.value = null
  }

  async function getAccessToken() {
    if (!authEnabled.value) {
      return null
    }

    if (!initialized.value) {
      await init()
    }

    if (session.value?.access_token) {
      return session.value.access_token
    }

    await syncSession()
    return session.value?.access_token ?? null
  }

  return {
    user,
    session,
    initialized,
    authEnabled,
    loading,
    isAuthenticated,
    init,
    signIn,
    signOut,
    getAccessToken,
  }
})
