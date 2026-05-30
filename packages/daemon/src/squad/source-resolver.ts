import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '@io/shared';
import { createChildLogger } from '../logging/logger.js';

const logger = () => createChildLogger('source-resolver');

/**
 * Parse a GitHub URL into owner/repo parts.
 * Supports https://github.com/owner/repo and https://github.com/owner/repo.git
 */
export function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
	const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
	if (!match) return null;
	return { owner: match[1], repo: match[2] };
}

/**
 * Get the local source directory for a given GitHub repo URL.
 * Convention: ~/.io/source/{owner}/{repo}
 */
export function getSourcePath(repoUrl: string): string | null {
	const parsed = parseGitHubUrl(repoUrl);
	if (!parsed) return null;
	const config = loadConfig();
	return join(config.dataDir, 'source', parsed.owner, parsed.repo);
}

/**
 * Ensure a repo is cloned locally. If the directory already exists and contains
 * a .git folder, it is assumed valid and left alone. Otherwise, it clones the repo.
 * Returns the absolute path to the local clone.
 */
export function ensureCloned(repoUrl: string): string {
	const log = logger();
	const sourcePath = getSourcePath(repoUrl);
	if (!sourcePath) {
		throw new Error(`Cannot parse GitHub URL: ${repoUrl}`);
	}

	if (existsSync(join(sourcePath, '.git'))) {
		log.debug({ sourcePath }, 'Repo already cloned');
		return sourcePath;
	}

	log.info({ repoUrl, sourcePath }, 'Cloning repository');
	mkdirSync(sourcePath, { recursive: true });

	execSync(`git clone "${repoUrl}" "${sourcePath}"`, {
		stdio: 'pipe',
		timeout: 120_000,
	});

	log.info({ sourcePath }, 'Clone complete');
	return sourcePath;
}
