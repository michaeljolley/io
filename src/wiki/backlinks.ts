import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { PATHS } from "../paths.js";
import { listPages } from "./fs.js";

export async function getBacklinks(targetPath: string): Promise<string[]> {
  if (!existsSync(PATHS.wikiPages)) return [];

  const pages = await listPages();
  const backlinks: string[] = [];

  // Normalize the target path (ensure .md extension)
  const normalizedTarget = targetPath.endsWith(".md") ? targetPath : `${targetPath}.md`;

  for (const pagePath of pages) {
    if (pagePath === normalizedTarget) continue; // Skip self-references

    const fullPath = join(PATHS.wikiPages, pagePath);
    const content = readFileSync(fullPath, "utf-8");

    if (pageLinksTo(content, pagePath, normalizedTarget)) {
      backlinks.push(pagePath);
    }
  }

  return backlinks;
}

function pageLinksTo(content: string, fromPage: string, targetPage: string): boolean {
  const fromDir = dirname(fromPage);
  const targetWithoutExt = targetPage.replace(/\.md$/, "");

  // Check standard markdown links: [text](url)
  const markdownLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const linkHref = match[2].split("#")[0].trim(); // Strip anchors and whitespace
    if (!linkHref || linkHref.startsWith("http://") || linkHref.startsWith("https://")) continue;

    const resolvedLink = resolve("/", fromDir, linkHref).slice(1); // Resolve relative path, strip leading /
    const resolvedWithoutExt = resolvedLink.endsWith(".md") ? resolvedLink.slice(0, -3) : resolvedLink;

    if (resolvedWithoutExt === targetWithoutExt) return true;
  }

  // Check wiki-style links: [[page]] or [[page|display text]]
  // Wiki-style links are resolved from the wiki root (absolute), not relative to the current page
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const linkTarget = match[1].split("|")[0].trim(); // Handle [[page|display text]]
    if (!linkTarget) continue;

    const resolvedWithoutExt = linkTarget.endsWith(".md") ? linkTarget.slice(0, -3) : linkTarget;

    if (resolvedWithoutExt === targetWithoutExt) return true;
  }

  return false;
}
