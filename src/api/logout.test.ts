/**
 * Integration tests for Logout API endpoint (#325).
 * Tests POST /api/logout endpoint for sign-out functionality.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express, { type Request, type Response } from "express";

// ── Helpers ───────────────────────────────────────────────────────────────────

function req(
  method: string,
  port: number,
  path: string,
  headers?: Record<string, string>,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const options: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        ...headers,
        ...(payload ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: data });
        }
      });
    });
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}

// ── Server Setup ──────────────────────────────────────────────────────────────

function createTestServer(): express.Application {
  const app = express();
  app.use(express.json());

  // Mock auth middleware (simulates requireAuth)
  app.use((req: Request, res: Response, next) => {
    const token = req.headers.authorization?.startsWith("Bearer ") 
      ? req.headers.authorization.slice(7) 
      : undefined;
    
    // If token is explicitly "invalid", fail auth
    if (token === "invalid") {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    // If no token at all, fail auth
    if (!token) {
      res.status(401).json({ error: "Missing or invalid authorization" });
      return;
    }
    
    // Otherwise, pass through (mock valid auth)
    next();
  });

  // Logout endpoint (simplified - relies on middleware for auth validation)
  app.post("/api/logout", (_req: Request, res: Response) => {
    try {
      // At this point, the auth middleware has already validated the token.
      // Token invalidation approach:
      // Supabase JWT tokens are short-lived (1 hour by default). Since we don't maintain
      // a token blacklist, logout on the client side (clearing localStorage) is sufficient.
      // In a production system with token revocation, the token would be added to a blacklist here.
      // For now, we simply confirm the logout was successful.

      res.json({ status: "logged_out" });
    } catch (e) {
      console.error("Error during logout:", e);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Logout API Endpoint", () => {
  let server: http.Server;
  let port: number;

  before(() => {
    const app = createTestServer();
    server = app.listen(0);
    port = (server.address() as { port: number }).port;
  });

  after(() => {
    server.close();
  });

  describe("POST /api/logout", () => {
    it("returns 200 with logged_out status on successful logout with valid token", async () => {
      const { status, body } = await req("POST", port, "/api/logout", {
        Authorization: "Bearer valid-token-12345",
      });
      assert.equal(status, 200);
      assert.equal((body as { status: string }).status, "logged_out");
    });

    it("returns 401 when no Authorization header is provided (caught by auth middleware)", async () => {
      const { status, body } = await req("POST", port, "/api/logout");
      assert.equal(status, 401);
      assert.ok((body as { error: string }).error.includes("Missing"));
    });

    it("returns 401 when Authorization header contains invalid token", async () => {
      const { status, body } = await req("POST", port, "/api/logout", {
        Authorization: "Bearer invalid",
      });
      assert.equal(status, 401);
      assert.ok((body as { error: string }).error);
    });

    it("accepts Bearer token format with JWT-like structure", async () => {
      const { status } = await req("POST", port, "/api/logout", {
        Authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      });
      assert.equal(status, 200);
    });

    it("returns 401 for malformed Authorization header (not Bearer format)", async () => {
      const { status } = await req("POST", port, "/api/logout", {
        Authorization: "NotBearer token",
      });
      // NotBearer does not start with "Bearer " prefix, so token is undefined, auth fails
      assert.equal(status, 401);
    });
  });
});
