import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { DB_PATH } from "@io/shared/paths";
import { type Client, type Row, createClient } from "@libsql/client";

export type DatabaseClient = Client;
export type DatabaseRow = Row;

export interface DatabaseConnectionOptions {
	path?: string;
	url?: string;
}

interface Migration {
	version: number;
	name: string;
	statements: string[];
}

const MIGRATIONS: Migration[] = [
	{
		version: 1,
		name: "create-store-schema",
		statements: [
			`CREATE TABLE IF NOT EXISTS squads (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				repo_url TEXT NOT NULL,
				repo_owner TEXT NOT NULL,
				repo_name TEXT NOT NULL,
				status TEXT NOT NULL,
				config TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				UNIQUE (repo_owner, repo_name)
			)`,
			`CREATE TABLE IF NOT EXISTS squad_members (
				id TEXT PRIMARY KEY,
				squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
				role TEXT NOT NULL,
				name TEXT NOT NULL,
				system_prompt TEXT NOT NULL,
				model TEXT,
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS objectives (
				id TEXT PRIMARY KEY,
				squad_id TEXT NOT NULL REFERENCES squads(id) ON DELETE CASCADE,
				description TEXT NOT NULL,
				status TEXT NOT NULL,
				plan TEXT,
				revision_count INTEGER NOT NULL DEFAULT 0,
				branch TEXT,
				pr_url TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS tasks (
				id TEXT PRIMARY KEY,
				objective_id TEXT NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
				assignee_id TEXT REFERENCES squad_members(id) ON DELETE SET NULL,
				title TEXT NOT NULL,
				description TEXT NOT NULL,
				status TEXT NOT NULL,
				result TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS conversations (
				id TEXT PRIMARY KEY,
				title TEXT,
				source TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS messages (
				id TEXT PRIMARY KEY,
				conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
				role TEXT NOT NULL,
				content TEXT NOT NULL,
				model TEXT,
				input_tokens INTEGER,
				output_tokens INTEGER,
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS inbox (
				id TEXT PRIMARY KEY,
				squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL,
				objective_id TEXT REFERENCES objectives(id) ON DELETE SET NULL,
				type TEXT NOT NULL,
				title TEXT NOT NULL,
				content TEXT NOT NULL,
				status TEXT NOT NULL,
				reply TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS schedules (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				cron_expression TEXT NOT NULL,
				prompt TEXT NOT NULL,
				enabled INTEGER NOT NULL DEFAULT 1,
				last_run_at TEXT,
				next_run_at TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS token_usage (
				id TEXT PRIMARY KEY,
				squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL,
				agent_id TEXT,
				model TEXT NOT NULL,
				input_tokens INTEGER NOT NULL,
				output_tokens INTEGER NOT NULL,
				cost REAL NOT NULL,
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS activity (
				id TEXT PRIMARY KEY,
				squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL,
				objective_id TEXT REFERENCES objectives(id) ON DELETE SET NULL,
				event TEXT NOT NULL,
				description TEXT NOT NULL,
				metadata TEXT,
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS agent_history (
				id TEXT PRIMARY KEY,
				agent_id TEXT NOT NULL,
				squad_id TEXT REFERENCES squads(id) ON DELETE SET NULL,
				content TEXT NOT NULL,
				created_at TEXT NOT NULL
			)`,
			`CREATE TABLE IF NOT EXISTS settings (
				key TEXT PRIMARY KEY,
				value TEXT
			)`,
			"CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON squad_members(squad_id)",
			"CREATE INDEX IF NOT EXISTS idx_objectives_squad_id ON objectives(squad_id)",
			"CREATE INDEX IF NOT EXISTS idx_objectives_status ON objectives(status)",
			"CREATE INDEX IF NOT EXISTS idx_tasks_objective_id ON tasks(objective_id)",
			"CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id)",
			"CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at)",
			"CREATE INDEX IF NOT EXISTS idx_inbox_status_created_at ON inbox(status, created_at)",
			"CREATE INDEX IF NOT EXISTS idx_inbox_squad_id ON inbox(squad_id)",
			"CREATE INDEX IF NOT EXISTS idx_inbox_objective_id ON inbox(objective_id)",
			"CREATE INDEX IF NOT EXISTS idx_schedules_enabled_next_run_at ON schedules(enabled, next_run_at)",
			"CREATE INDEX IF NOT EXISTS idx_token_usage_created_at ON token_usage(created_at)",
			"CREATE INDEX IF NOT EXISTS idx_token_usage_squad_id ON token_usage(squad_id)",
			"CREATE INDEX IF NOT EXISTS idx_token_usage_agent_id ON token_usage(agent_id)",
			"CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model)",
			"CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity(created_at)",
			"CREATE INDEX IF NOT EXISTS idx_activity_squad_id ON activity(squad_id)",
			"CREATE INDEX IF NOT EXISTS idx_activity_objective_id ON activity(objective_id)",
			"CREATE INDEX IF NOT EXISTS idx_agent_history_agent_id_created_at ON agent_history(agent_id, created_at)",
		],
	},
];

let client: DatabaseClient | null = null;
let initPromise: Promise<DatabaseClient> | null = null;
let defaultConnectionOptions: DatabaseConnectionOptions = {};

export const generateId = (): string => crypto.randomUUID();
export const nowIso = (): string => new Date().toISOString();

export function asString(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (value === null || value === undefined) {
		throw new Error("Expected string value but received null or undefined");
	}

	return String(value);
}

export function asNullableString(value: unknown): string | null {
	if (value === null || value === undefined) {
		return null;
	}

	return typeof value === "string" ? value : String(value);
}

export function asNumber(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "bigint") {
		return Number(value);
	}

	if (typeof value === "string") {
		return Number(value);
	}

	throw new Error(`Expected numeric value but received ${typeof value}`);
}

export function asNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined) {
		return null;
	}

	return asNumber(value);
}

export function asBoolean(value: unknown): boolean {
	return asNumber(value) === 1;
}

export function toSqliteBoolean(value: boolean): number {
	return value ? 1 : 0;
}

export function parseJson<T>(value: unknown): T {
	if (typeof value !== "string") {
		return value as T;
	}

	return JSON.parse(value) as T;
}

export function serializeJson(value: unknown): string {
	return JSON.stringify(value);
}

export async function initDatabase(): Promise<DatabaseClient> {
	if (client && !client.closed) {
		return client;
	}

	if (initPromise) {
		return initPromise;
	}

	initPromise = initializeDatabase(defaultConnectionOptions);

	try {
		client = await initPromise;
		return client;
	} finally {
		initPromise = null;
	}
}

export async function getDatabase(): Promise<DatabaseClient> {
	return initDatabase();
}

export async function createDatabaseClient(
	options: DatabaseConnectionOptions = {},
): Promise<DatabaseClient> {
	return initializeDatabase(options);
}

export async function closeDatabase(databaseClient: DatabaseClient | null = client): Promise<void> {
	if (!databaseClient || databaseClient.closed) {
		if (databaseClient === client) {
			client = null;
			initPromise = null;
		}
		return;
	}

	await databaseClient.close();
	if (databaseClient === client) {
		client = null;
		initPromise = null;
	}
}

export async function resetDatabase(
	options: DatabaseConnectionOptions = {},
): Promise<DatabaseClient> {
	defaultConnectionOptions = options;
	await closeDatabase();
	client = await initializeDatabase(defaultConnectionOptions);
	return client;
}

async function initializeDatabase(
	options: DatabaseConnectionOptions = {},
): Promise<DatabaseClient> {
	const url = await resolveDatabaseUrl(options);
	const databaseClient = createClient({ url });

	await databaseClient.execute("PRAGMA foreign_keys = ON");
	await databaseClient.execute("PRAGMA journal_mode = WAL");
	await ensureMigrationTable(databaseClient);
	await applyMigrations(databaseClient);

	return databaseClient;
}

async function resolveDatabaseUrl(options: DatabaseConnectionOptions): Promise<string> {
	if (options.url) {
		return options.url;
	}

	const databasePath = options.path ?? DB_PATH;
	await mkdir(dirname(databasePath), { recursive: true });
	return pathToFileURL(databasePath).href;
}

async function ensureMigrationTable(databaseClient: DatabaseClient): Promise<void> {
	await databaseClient.executeMultiple(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version INTEGER PRIMARY KEY,
			name TEXT NOT NULL,
			applied_at TEXT NOT NULL
		);
	`);
}

async function applyMigrations(databaseClient: DatabaseClient): Promise<void> {
	const appliedVersions = await getAppliedVersions(databaseClient);

	for (const migration of MIGRATIONS) {
		if (appliedVersions.has(migration.version)) {
			continue;
		}

		const transaction = await databaseClient.transaction("write");

		try {
			for (const statement of migration.statements) {
				await transaction.execute(statement);
			}

			await transaction.execute({
				sql: "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
				args: [migration.version, migration.name, nowIso()],
			});
			await transaction.commit();
		} catch (error) {
			if (!transaction.closed) {
				await transaction.rollback();
			}
			throw error;
		} finally {
			if (!transaction.closed) {
				transaction.close();
			}
		}
	}
}

async function getAppliedVersions(databaseClient: DatabaseClient): Promise<Set<number>> {
	const result = await databaseClient.execute(
		"SELECT version FROM schema_migrations ORDER BY version ASC",
	);

	return new Set(result.rows.map((row) => asNumber(row.version)));
}
