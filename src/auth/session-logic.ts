/**
 * Pure session-handling logic extracted from web/src/stores/auth.ts.
 *
 * These functions contain the core behavioral decisions made across four
 * consecutive auth patches (#189→#192→#194→#196) that fixed undocumented
 * Supabase JS v2 side-effects. They are expressed as framework-agnostic
 * functions so they can be unit-tested with the Node test runner without
 * requiring Vue or Pinia.
 *
 * The authoritative implementation lives in web/src/stores/auth.ts.
 * Any change to the auth store's session logic MUST be reflected here and
 * all tests in session-logic.test.ts must continue to pass.
 */

export type MockSession = {
  access_token: string;
  /** Unix timestamp (seconds) — Supabase JWT exp claim */
  expires_at?: number;
  user?: { id: string };
};

export type AuthStateEvent =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"
  | "MFA_CHALLENGE_VERIFIED";

/**
 * Mirrors the onAuthStateChange handler in web/src/stores/auth.ts.
 *
 * Decision: only SIGNED_OUT clears the cached session. All other events that
 * fire with a null session (TOKEN_REFRESHED failure, lock timeout, internal
 * reconciliation) are intentionally ignored to prevent cache poisoning.
 *
 * See squad decision 2026-05-16 03:17:52 and issue #193.
 */
export function handleAuthStateChange(
  cachedSession: MockSession | null,
  event: AuthStateEvent,
  newSession: MockSession | null,
): MockSession | null {
  if (newSession) {
    // Accept any valid session regardless of event type
    return newSession;
  }
  if (event === "SIGNED_OUT") {
    // Only explicit sign-out clears the cache
    return null;
  }
  // All other null-session events: leave the existing cache untouched
  return cachedSession;
}

export type RefreshFn = () => Promise<MockSession | null>;

/**
 * Mirrors getAccessToken() in web/src/stores/auth.ts.
 *
 * Decisions:
 * - Reads from cached session — NEVER calls getSession() (Supabase JS v2
 *   side-effect: can fire onAuthStateChange(null) during reconciliation).
 * - Proactively refreshes when within 30 seconds of expiry.
 * - Falls back to refreshSession() if cache is null and auth is enabled.
 * - Returns null when auth is disabled.
 *
 * See squad decisions 2026-05-16 02:23:38, 2026-05-16 03:16:46 and issues
 * #191, #193.
 */
export async function getAccessToken(
  cachedSession: MockSession | null,
  authEnabled: boolean,
  refresh: RefreshFn,
  now: () => number = Date.now,
): Promise<string | null> {
  if (cachedSession?.access_token) {
    // Proactively refresh when within 30 seconds of expiry
    if (
      cachedSession.expires_at !== undefined &&
      cachedSession.expires_at * 1000 - now() < 30_000
    ) {
      try {
        const fresh = await refresh();
        if (fresh) return fresh.access_token;
      } catch {
        // fall through to cached token
      }
    }
    return cachedSession.access_token;
  }

  // No cached session — attempt recovery if auth is enabled.
  // Handles the edge case where the cache was spuriously cleared but a
  // valid refresh token still exists in storage.
  if (authEnabled) {
    try {
      const fresh = await refresh();
      if (fresh) return fresh.access_token;
    } catch {
      // fall through to null
    }
  }

  return null;
}
