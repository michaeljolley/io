import { execSync } from "node:child_process";
import { loadConfig, resetConfigCache } from "../config.js";

/**
 * Cached GitHub token for CLI operations.
 * Resolution order: GH_TOKEN env → GITHUB_TOKEN env → config.githubToken → `gh auth token` CLI.
 * If no token found, retries on next call (config may have been updated).
 */
let cachedToken: string | undefined;
let resolved = false;

export function resetGhTokenCache(): void {
  cachedToken = undefined;
  resolved = false;
}

export function getGhToken(): string | undefined {
  if (resolved && cachedToken) return cachedToken;

  // 1. Prefer explicit env vars
  if (process.env.GH_TOKEN) {
    cachedToken = process.env.GH_TOKEN;
    resolved = true;
    return cachedToken;
  }
  if (process.env.GITHUB_TOKEN) {
    cachedToken = process.env.GITHUB_TOKEN;
    resolved = true;
    return cachedToken;
  }

  // 2. Check IO config file (re-read in case it was updated since last attempt)
  try {
    if (!cachedToken) resetConfigCache();
    const config = loadConfig();
    if (config.githubToken) {
      cachedToken = config.githubToken;
      resolved = true;
      return cachedToken;
    }
  } catch {
    // Config not available
  }

  // 3. Try extracting from gh CLI auth (only on first attempt)
  if (!resolved) {
    try {
      const token = execSync("gh auth token", {
        timeout: 5_000,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      if (token) {
        cachedToken = token;
        resolved = true;
      }
    } catch {
      // gh not available or not authenticated
    }
  }

  // Mark resolved only if we found a token — otherwise retry next call
  if (cachedToken) resolved = true;
  return cachedToken;
}
