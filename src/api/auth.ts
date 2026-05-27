import type { Request, Response, NextFunction } from "express";
import type { Config } from "../config.js";

export function createAuthMiddleware(config: Config) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // All API routes require authentication
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    const token = authHeader.slice(7);

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      res.status(500).json({ error: "Supabase auth not configured" });
      return;
    }

    try {
      // Validate JWT with Supabase
      const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: config.supabaseAnonKey,
        },
      });

      if (!response.ok) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }

      const user = (await response.json()) as { email?: string };

      // Check authorized email
      if (config.authorizedEmail && user.email !== config.authorizedEmail) {
        res.status(403).json({ error: "Unauthorized user" });
        return;
      }

      // Attach user to request
      (req as any).user = user;
      next();
    } catch (err) {
      res.status(401).json({ error: "Authentication failed" });
    }
  };
}
