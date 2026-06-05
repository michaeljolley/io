import { existsSync, readFileSync } from "node:fs";

import { API_PORT, DEFAULT_MODEL, SESSION_RESET_THRESHOLD } from "@io/shared";
import { CONFIG_PATH } from "@io/shared/paths";
import { z } from "zod";

const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error"]);

const configSchema = z.object({
	port: z.coerce.number().int().positive().default(API_PORT),
	logLevel: logLevelSchema.default("info"),
	defaultModel: z.string().trim().min(1).default(DEFAULT_MODEL),
	telegramToken: z.string().trim().min(1).nullable().default(null),
	telegramUserId: z.string().trim().min(1).nullable().default(null),
	supabaseUrl: z.string().trim().min(1).nullable().default(null),
	supabaseAnonKey: z.string().trim().min(1).nullable().default(null),
	sessionResetThreshold: z.coerce.number().int().positive().default(SESSION_RESET_THRESHOLD),
});

export type Config = z.infer<typeof configSchema>;

type ConfigInput = Partial<Record<keyof Config, unknown>>;

function parseConfigFile(): ConfigInput {
	if (!existsSync(CONFIG_PATH)) {
		return {};
	}

	const rawConfig = readFileSync(CONFIG_PATH, "utf8");
	const parsedConfig: unknown = JSON.parse(rawConfig);

	if (parsedConfig === null || typeof parsedConfig !== "object" || Array.isArray(parsedConfig)) {
		throw new Error(`Invalid config file at ${CONFIG_PATH}: expected a JSON object`);
	}

	return parsedConfig as ConfigInput;
}

function normalizeNullableString(value: string | undefined): string | null | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeRequiredString(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function readEnvOverrides(): ConfigInput {
	const overrides: ConfigInput = {};

	if (process.env.IO_PORT !== undefined) {
		overrides.port = process.env.IO_PORT;
	}

	if (process.env.IO_LOG_LEVEL !== undefined) {
		overrides.logLevel = process.env.IO_LOG_LEVEL;
	}

	if (process.env.IO_TELEGRAM_TOKEN !== undefined) {
		overrides.telegramToken = normalizeNullableString(process.env.IO_TELEGRAM_TOKEN);
	}

	if (process.env.IO_TELEGRAM_USER_ID !== undefined) {
		overrides.telegramUserId = normalizeNullableString(process.env.IO_TELEGRAM_USER_ID);
	}

	if (process.env.IO_SUPABASE_URL !== undefined) {
		overrides.supabaseUrl = normalizeNullableString(process.env.IO_SUPABASE_URL);
	}

	if (process.env.IO_SUPABASE_ANON_KEY !== undefined) {
		overrides.supabaseAnonKey = normalizeNullableString(process.env.IO_SUPABASE_ANON_KEY);
	}

	if (process.env.IO_DEFAULT_MODEL !== undefined) {
		overrides.defaultModel = normalizeRequiredString(process.env.IO_DEFAULT_MODEL);
	}

	if (process.env.IO_SESSION_RESET_THRESHOLD !== undefined) {
		overrides.sessionResetThreshold = process.env.IO_SESSION_RESET_THRESHOLD;
	}

	return overrides;
}

export function loadConfig(): Config {
	const fileConfig = parseConfigFile();
	const envOverrides = readEnvOverrides();

	return configSchema.parse({
		...fileConfig,
		...envOverrides,
	});
}
