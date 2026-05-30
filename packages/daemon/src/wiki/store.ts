import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../logging/logger.js';

const logger = () => createChildLogger('wiki');

export type WikiScope = 'io' | 'shared' | string; // string = squad name

export interface WikiPage {
	scope: string;
	name: string;
	content: string;
}

export interface WikiSearchResult {
	scope: string;
	name: string;
	matches: string[];
}

let wikiRoot = '';

/**
 * Initialize the wiki directory structure.
 */
export function initWiki(dataDir: string): void {
	wikiRoot = join(dataDir, 'wiki');
	mkdirSync(join(wikiRoot, 'io'), { recursive: true });
	mkdirSync(join(wikiRoot, 'shared'), { recursive: true });
	mkdirSync(join(wikiRoot, 'squads'), { recursive: true });
	logger().info({ wikiRoot }, 'Wiki initialized');
}

/**
 * Ensure a squad wiki folder exists.
 */
export function ensureSquadWiki(squadName: string): void {
	const dir = join(wikiRoot, 'squads', squadName);
	mkdirSync(dir, { recursive: true });
}

function scopeDir(scope: WikiScope): string {
	if (scope === 'io') return join(wikiRoot, 'io');
	if (scope === 'shared') return join(wikiRoot, 'shared');
	return join(wikiRoot, 'squads', scope);
}

/**
 * List all page names in a scope.
 */
export function listWikiPages(scope: WikiScope): string[] {
	const dir = scopeDir(scope);
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((f) => f.endsWith('.md'))
		.map((f) => f.replace(/\.md$/, ''));
}

/**
 * Read a wiki page. Returns null if it doesn't exist.
 */
export function readWikiPage(scope: WikiScope, pageName: string): WikiPage | null {
	const filePath = join(scopeDir(scope), `${pageName}.md`);
	if (!existsSync(filePath)) return null;
	const content = readFileSync(filePath, 'utf-8');
	return { scope, name: pageName, content };
}

/**
 * Write (create or overwrite) a wiki page.
 */
export function writeWikiPage(scope: WikiScope, pageName: string, content: string): WikiPage {
	const dir = scopeDir(scope);
	mkdirSync(dir, { recursive: true });
	const filePath = join(dir, `${pageName}.md`);
	writeFileSync(filePath, content, 'utf-8');
	logger().info({ scope, pageName }, 'Wiki page written');
	return { scope, name: pageName, content };
}

/**
 * Search wiki pages by keyword across one or more scopes.
 * Returns matching pages with context lines.
 */
export function searchWiki(keyword: string, scopes: WikiScope[]): WikiSearchResult[] {
	const results: WikiSearchResult[] = [];
	const lower = keyword.toLowerCase();

	for (const scope of scopes) {
		const pages = listWikiPages(scope);
		for (const pageName of pages) {
			const page = readWikiPage(scope, pageName);
			if (!page) continue;

			const lines = page.content.split('\n');
			const matches: string[] = [];
			for (const line of lines) {
				if (line.toLowerCase().includes(lower)) {
					matches.push(line.trim());
				}
			}

			if (matches.length > 0) {
				results.push({ scope, name: pageName, matches: matches.slice(0, 5) });
			}
		}
	}

	return results;
}

/**
 * Get accessible scopes for a squad agent.
 */
export function getSquadScopes(squadName: string): WikiScope[] {
	return ['shared', squadName];
}

/**
 * Get accessible scopes for the orchestrator.
 */
export function getOrchestratorScopes(): WikiScope[] {
	return ['io', 'shared'];
}

/**
 * Get a summary of available pages for injection into system prompts.
 */
export function getPageListing(scopes: WikiScope[]): string {
	const sections: string[] = [];
	for (const scope of scopes) {
		const pages = listWikiPages(scope);
		if (pages.length > 0) {
			const label = scope === 'io' ? 'IO' : scope === 'shared' ? 'Shared' : `Squad (${scope})`;
			sections.push(`${label}: ${pages.join(', ')}`);
		}
	}
	return sections.length > 0 ? sections.join('\n') : '(no wiki pages yet)';
}
