/**
 * Auth session handling regression tests — Supabase JS v2 integration decisions.
 *
 * These tests guard the behavioral decisions made across four consecutive auth
 * patches (#189→#192→#194→#196) that fixed undocumented Supabase JS v2 side-
 * effects. They test the logic extracted into src/auth/session-logic.ts, which
 * mirrors the implementation in web/src/stores/auth.ts.
 *
 * If auth store logic changes, update session-logic.ts to match AND verify
 * these tests still pass.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  handleAuthStateChange,
  getAccessToken,
  type MockSession,
} from "./session-logic.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    access_token: "tok-abc",
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    user: { id: "user-1" },
    ...overrides,
  };
}

const neverCalled: () => Promise<MockSession | null> = async () => {
  throw new Error("refresh should not have been called");
};

// Use a fixed epoch (multiple of 1000ms) for deterministic boundary tests.
// T = 1_000_000_000_000ms (epoch seconds = 1_000_000_000)
const FIXED_NOW_MS = 1_000_000_000_000;
const FIXED_NOW_S = FIXED_NOW_MS / 1000; // 1_000_000_000

// ── onAuthStateChange session caching ────────────────────────────────────────

describe("handleAuthStateChange — onAuthStateChange caching rules", () => {
  it("accepts a valid session on SIGNED_IN", () => {
    const s = makeSession();
    const result = handleAuthStateChange(null, "SIGNED_IN", s);
    assert.deepEqual(result, s);
  });

  it("accepts a valid session on INITIAL_SESSION", () => {
    const s = makeSession();
    const result = handleAuthStateChange(null, "INITIAL_SESSION", s);
    assert.deepEqual(result, s);
  });

  it("accepts a valid session on TOKEN_REFRESHED", () => {
    const old = makeSession({ access_token: "tok-old" });
    const fresh = makeSession({ access_token: "tok-new" });
    const result = handleAuthStateChange(old, "TOKEN_REFRESHED", fresh);
    assert.equal(result?.access_token, "tok-new");
  });

  // Critical regression: SIGNED_OUT is the ONLY event that clears the cache.
  it("clears session on SIGNED_OUT with null session", () => {
    const s = makeSession();
    const result = handleAuthStateChange(s, "SIGNED_OUT", null);
    assert.equal(result, null);
  });

  // Critical regression: internal null-session events must NOT poison the cache.
  it("does NOT clear session on TOKEN_REFRESHED with null — keeps existing cache", () => {
    const cached = makeSession({ access_token: "tok-valid" });
    const result = handleAuthStateChange(cached, "TOKEN_REFRESHED", null);
    assert.equal(result?.access_token, "tok-valid");
  });

  it("does NOT clear session on INITIAL_SESSION with null — keeps existing cache", () => {
    const cached = makeSession({ access_token: "tok-valid" });
    const result = handleAuthStateChange(cached, "INITIAL_SESSION", null);
    assert.equal(result?.access_token, "tok-valid");
  });

  it("does NOT clear session on USER_UPDATED with null — keeps existing cache", () => {
    const cached = makeSession({ access_token: "tok-valid" });
    const result = handleAuthStateChange(cached, "USER_UPDATED", null);
    assert.equal(result?.access_token, "tok-valid");
  });

  it("returns null when cache is already null and null-session event fires", () => {
    const result = handleAuthStateChange(null, "TOKEN_REFRESHED", null);
    assert.equal(result, null);
  });

  it("null-session SIGNED_OUT with no prior cache stays null", () => {
    const result = handleAuthStateChange(null, "SIGNED_OUT", null);
    assert.equal(result, null);
  });
});

// ── getAccessToken — cached session path ─────────────────────────────────────

describe("getAccessToken — reads from cached session", () => {
  it("returns cached access token when session is valid and not near expiry", async () => {
    const session = makeSession({ access_token: "tok-valid" });
    const token = await getAccessToken(session, true, neverCalled);
    assert.equal(token, "tok-valid");
  });

  it("returns null when auth is disabled and cache is null", async () => {
    const token = await getAccessToken(null, false, neverCalled);
    assert.equal(token, null);
  });
});

// ── getAccessToken — proactive refresh near expiry ───────────────────────────

describe("getAccessToken — proactive refresh within 30s of expiry", () => {
  it("calls refresh and returns new token when within 30s of expiry", async () => {
    // Session expires in 25 seconds (within 30s threshold)
    const session = makeSession({
      access_token: "tok-expiring",
      expires_at: Math.floor(Date.now() / 1000) + 25,
    });
    const freshSession = makeSession({ access_token: "tok-fresh" });
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return freshSession; };

    const token = await getAccessToken(session, true, refresh);
    assert.equal(refreshCalled, true);
    assert.equal(token, "tok-fresh");
  });

  it("does NOT call refresh when expiry is more than 30s away", async () => {
    const session = makeSession({
      access_token: "tok-valid",
      expires_at: Math.floor(Date.now() / 1000) + 60, // 60s away
    });
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return null; };

    const token = await getAccessToken(session, true, refresh);
    assert.equal(refreshCalled, false);
    assert.equal(token, "tok-valid");
  });

  it("falls back to cached token if refresh throws near expiry", async () => {
    const session = makeSession({
      access_token: "tok-expiring",
      expires_at: Math.floor(Date.now() / 1000) + 10,
    });
    const refresh = async () => { throw new Error("network error"); };

    const token = await getAccessToken(session, true, refresh);
    assert.equal(token, "tok-expiring");
  });

  it("falls back to cached token if refresh returns null near expiry", async () => {
    const session = makeSession({
      access_token: "tok-expiring",
      expires_at: Math.floor(Date.now() / 1000) + 10,
    });
    const refresh = async () => null;

    const token = await getAccessToken(session, true, refresh);
    assert.equal(token, "tok-expiring");
  });

  // Boundary: expires_at * 1000 - now == 30_000 is NOT < 30_000, so no refresh.
  // Use FIXED_NOW_MS (exact multiple of 1000) to avoid floor-truncation artifacts.
  it("does NOT refresh when exactly 30s remain (boundary is exclusive)", async () => {
    const session = makeSession({
      access_token: "tok-boundary",
      expires_at: FIXED_NOW_S + 30, // exactly 30_000ms away from FIXED_NOW_MS
    });
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return null; };

    const token = await getAccessToken(session, true, refresh, () => FIXED_NOW_MS);
    assert.equal(refreshCalled, false);
    assert.equal(token, "tok-boundary");
  });

  // Boundary: expires_at * 1000 - now == 29_000 is < 30_000, so refresh fires.
  it("refreshes when 29s remain (1s inside the 30s window)", async () => {
    const freshSession = makeSession({ access_token: "tok-refreshed" });
    const session = makeSession({
      access_token: "tok-boundary",
      expires_at: FIXED_NOW_S + 29, // 29_000ms away — within threshold
    });
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return freshSession; };

    const token = await getAccessToken(session, true, refresh, () => FIXED_NOW_MS);
    assert.equal(refreshCalled, true);
    assert.equal(token, "tok-refreshed");
  });
});

// ── getAccessToken — recovery fallback when cache is null ────────────────────

describe("getAccessToken — recovery fallback when cache is null", () => {
  it("attempts refreshSession() when cache is null and auth is enabled", async () => {
    const freshSession = makeSession({ access_token: "tok-recovered" });
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return freshSession; };

    const token = await getAccessToken(null, true, refresh);
    assert.equal(refreshCalled, true);
    assert.equal(token, "tok-recovered");
  });

  it("returns null when auth is enabled but refreshSession() returns null", async () => {
    const token = await getAccessToken(null, true, async () => null);
    assert.equal(token, null);
  });

  it("returns null when auth is enabled but refreshSession() throws", async () => {
    const refresh = async () => { throw new Error("refresh failed"); };
    const token = await getAccessToken(null, true, refresh);
    assert.equal(token, null);
  });

  it("does NOT call refreshSession() when auth is disabled", async () => {
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return null; };

    const token = await getAccessToken(null, false, refresh);
    assert.equal(refreshCalled, false);
    assert.equal(token, null);
  });
});

// ── getAccessToken — session without expires_at ───────────────────────────────

describe("getAccessToken — session without expires_at", () => {
  it("returns cached token without attempting refresh if expires_at is undefined", async () => {
    const session: MockSession = { access_token: "tok-no-expiry" };
    let refreshCalled = false;
    const refresh = async () => { refreshCalled = true; return null; };

    const token = await getAccessToken(session, true, refresh);
    assert.equal(refreshCalled, false);
    assert.equal(token, "tok-no-expiry");
  });
});
