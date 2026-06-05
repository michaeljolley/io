import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR, LOGS_DIR, SKILLS_DIR, WIKI_DIR } from "@io/shared/paths";

const WIKI_PAGES_DIR = join(WIKI_DIR, "pages");

export function ensureDataDirectories(): void {
	for (const directory of [DATA_DIR, WIKI_DIR, WIKI_PAGES_DIR, SKILLS_DIR, LOGS_DIR]) {
		mkdirSync(directory, { recursive: true });
	}
}
