import { useAuthStore } from '../stores/auth'
import { getSupabase } from './supabase'

/**
 * Wrapper around fetch() that injects the Supabase Bearer token
 * when auth is enabled.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const auth = useAuthStore()
  const token = auth.getAccessToken()

  const headers = new Headers(init?.headers)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(input, { ...init, headers })

  // On 401, try to refresh the Supabase session before giving up.
  // This handles the race where the access token expires during a background
  // token-refresh — Supabase would have auto-refreshed, but the in-flight
  // request already got a 401.  One retry is enough; we never loop.
  if (res.status === 401 && auth.authEnabled) {
    const supabase = await getSupabase()
    if (supabase) {
      const { data } = await supabase.auth.refreshSession()
      if (data.session) {
        // Retry the original request with the fresh token
        const retryHeaders = new Headers(init?.headers)
        retryHeaders.set('Authorization', `Bearer ${data.session.access_token}`)
        return fetch(input, { ...init, headers: retryHeaders })
      }
    }
    // Refresh failed — session is truly gone, sign out
    await auth.signOut()
  }

  return res
}

/**
 * Build an EventSource URL with the access token as a query param.
 * The server can read `req.query.token` for SSE endpoints.
 */
export function authenticatedUrl(path: string): string {
  const auth = useAuthStore()
  const token = auth.getAccessToken()
  if (!token) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}token=${encodeURIComponent(token)}`
}
