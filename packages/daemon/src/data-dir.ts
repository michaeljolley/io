import { mkdirSync } from "node:fs";

import { DATA_DIR, LOGS_DIR, SKILLS_DIR, WIKI_DIR } from "@io/shared/paths";

export function ensureDataDirectories(): void {
	for (const directory of [DATA_DIR, WIKI_DIR, SKILLS_DIR, LOGS_DIR]) {
		mkdirSync(directory, { recursive: true });
	}
}
