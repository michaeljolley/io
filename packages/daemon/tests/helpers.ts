import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";

import {
	type DatabaseClient,
	closeDatabase,
	createDatabaseClient,
	resetDatabase,
} from "../src/store/db.js";

const TEMP_ROOT = join(process.cwd(), ".vitest-temp");

export interface DatabaseTestContext {
	db: DatabaseClient;
	dir: string;
	dbPath: string;
}

export async function createTempDirectory(prefix: string): Promise<string> {
	await mkdir(TEMP_ROOT, { recursive: true });
	return mkdtemp(join(TEMP_ROOT, `${prefix}-`));
}

export async function createStoreTestContext(): Promise<DatabaseTestContext> {
	const dir = await createTempDirectory("db");
	const dbPath = join(dir, "io.db");
	const db = await createDatabaseClient({ path: dbPath });
	return { db, dir, dbPath };
}

export async function cleanupStoreTestContext(context: DatabaseTestContext | null): Promise<void> {
	if (!context) {
		return;
	}

	await closeDatabase(context.db);
}

export async function createGlobalStoreTestContext(): Promise<DatabaseTestContext> {
	const dir = await createTempDirectory("global-db");
	const dbPath = join(dir, "io.db");
	const db = await resetDatabase({ path: dbPath });
	return { db, dir, dbPath };
}

export async function cleanupGlobalStoreTestContext(
	context: DatabaseTestContext | null,
): Promise<void> {
	if (!context) {
		return;
	}

	await closeDatabase();
}

export async function pause(milliseconds = 5): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
