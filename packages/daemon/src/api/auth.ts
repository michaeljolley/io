import type { RequestHandler } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";

export interface AuthConfig {
	supabaseUrl?: string | null;
	supabaseAnonKey?: string | null;
}

export function createAuthMiddleware(config: AuthConfig): RequestHandler {
	const supabaseUrl = config.supabaseUrl?.trim();
	const supabaseAnonKey = config.supabaseAnonKey?.trim();

	if (!supabaseUrl || !supabaseAnonKey) {
		return (_req, _res, next) => {
			next();
		};
	}

	const normalizedBaseUrl = supabaseUrl.endsWith("/") ? supabaseUrl : `${supabaseUrl}/`;
	const issuer = new URL("auth/v1", normalizedBaseUrl).toString().replace(/\/$/, "");
	const jwks = createRemoteJWKSet(new URL("auth/v1/.well-known/jwks.json", normalizedBaseUrl));

	return async (req, res, next) => {
		try {
			const header = req.header("authorization");

			if (!header || !header.startsWith("Bearer ")) {
				res.status(401).json({ error: "Authorization bearer token required" });
				return;
			}

			const token = header.slice("Bearer ".length).trim();

			if (!token) {
				res.status(401).json({ error: "Authorization bearer token required" });
				return;
			}

			const { payload } = await jwtVerify(token, jwks, {
				issuer,
			});
			res.locals.auth = payload;
			next();
		} catch (error) {
			res.status(401).json({
				error: "Invalid authorization token",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	};
}
