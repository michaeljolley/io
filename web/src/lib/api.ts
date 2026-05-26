import { useAuthStore } from '@/stores/auth'
import { getSupabase } from './supabase'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function resolveApiPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const auth = useAuthStore()
  const target = resolveApiPath(path)
  const headers = new Headers(init?.headers)
  const token = await auth.getAccessToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(target, { ...init, headers })

  if (response.status === 401 && auth.authEnabled) {
    const supabase = await getSupabase()
    if (supabase) {
      const { data, error } = await supabase.auth.refreshSession()
      if (data.session) {
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${data.session.access_token}`)
        return fetch(target, { ...init, headers: retryHeaders })
      }
      if (!error) {
        await auth.signOut()
      }
    }
  }

  return response
}

export async function authenticatedUrl(path: string): Promise<string> {
  const auth = useAuthStore()
  const token = await auth.getAccessToken()
  const resolved = resolveApiPath(path)
  const url = /^https?:\/\//i.test(resolved)
    ? new URL(resolved)
    : new URL(resolved, window.location.origin)

  if (token) {
    url.searchParams.set('token', token)
  }

  return url.toString()
}
