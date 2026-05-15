#!/usr/bin/env tsx
/**
 * Fetch recent GitHub releases and write them to src/releases.json.
 * Run during build: npx tsx scripts/fetch-releases.ts
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const REPO = "michaeljolley/io";
const LIMIT = 10;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "../src/releases.json");

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
}

async function main(): Promise<void> {
  try {
    const headers: Record<string, string> = { "User-Agent": "io-release-fetch/1.0" };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases?per_page=${LIMIT}`,
      { headers },
    );
    if (!res.ok) {
      console.warn(`[fetch-releases] GitHub API returned ${res.status}, writing empty array`);
      writeFileSync(OUTPUT, "[]");
      return;
    }
    const releases = (await res.json()) as GitHubRelease[];
    const simplified = releases.map((r) => ({
      tag: r.tag_name,
      name: r.name ?? r.tag_name,
      body: r.body ?? "",
      published_at: r.published_at,
      html_url: r.html_url,
    }));
    writeFileSync(OUTPUT, JSON.stringify(simplified, null, 2));
    console.log(`[fetch-releases] Wrote ${simplified.length} releases to ${OUTPUT}`);
  } catch (err) {
    console.warn("[fetch-releases] Failed to fetch:", err);
    writeFileSync(OUTPUT, "[]");
  }
}

main();
