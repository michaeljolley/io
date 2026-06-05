import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { AppSettings } from "@io/shared";
import { CONFIG_PATH } from "@io/shared/paths";
import { Router } from "express";

import { loadConfig } from "../../config.js";

const router = Router();
const APP_SETTING_KEYS = [
	"port",
	"logLevel",
	"defaultModel",
	"telegramToken",
	"telegramUserId",
	"supabaseUrl",
	"supabaseAnonKey",
	"sessionResetThreshold",
] as const satisfies Array<keyof AppSettings>;

type WritableSettings = Pick<AppSettings, (typeof APP_SETTING_KEYS)[number]>;

router.get("/api/settings", async (_req, res) => {
	try {
		res.status(200).json(loadConfig());
	} catch (error) {
		res.status(500).json({
			error: "Failed to load settings",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/settings", async (req, res) => {
	try {
		if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
			res.status(400).json({ error: "A settings object is required" });
			return;
		}

		const updates = normalizeSettingsUpdates(req.body as Record<string, unknown>);
		const current = await readPersistedSettings();
		const nextSettings: WritableSettings = {
			...current,
			...updates,
		};

		await mkdir(dirname(CONFIG_PATH), { recursive: true });
		await writeFile(CONFIG_PATH, `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
		res.status(200).json(loadConfig());
	} catch (error) {
		const statusCode = error instanceof Error && /Invalid setting/.test(error.message) ? 400 : 500;
		res.status(statusCode).json({
			error: "Failed to update settings",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

async function readPersistedSettings(): Promise<WritableSettings> {
	try {
		const raw = await readFile(CONFIG_PATH, "utf8");
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		return {
			...loadConfig(),
			...normalizeSettingsUpdates(parsed),
		};
	} catch (error) {
		if (isMissingFileError(error)) {
			return loadConfig();
		}

		throw error;
	}
}

function normalizeSettingsUpdates(input: Record<string, unknown>): Partial<WritableSettings> {
	const updates: Partial<WritableSettings> = {};

	for (const key of APP_SETTING_KEYS) {
		if (!(key in input)) {
			continue;
		}

		const value = input[key];
		switch (key) {
			case "port":
			case "sessionResetThreshold": {
				const parsed = Number(value);
				if (!Number.isInteger(parsed) || parsed <= 0) {
					throw new Error(`Invalid setting for ${key}`);
				}
				updates[key] = parsed;
				break;
			}
			case "telegramToken":
			case "telegramUserId":
			case "supabaseUrl":
			case "supabaseAnonKey": {
				if (value !== null && typeof value !== "string") {
					throw new Error(`Invalid setting for ${key}`);
				}
				updates[key] = typeof value === "string" ? value.trim() || null : value;
				break;
			}
			case "logLevel":
			case "defaultModel": {
				if (typeof value !== "string" || value.trim() === "") {
					throw new Error(`Invalid setting for ${key}`);
				}
				updates[key] = value.trim();
				break;
			}
		}
	}

	return updates;
}

function isMissingFileError(error: unknown): boolean {
	return !!error && typeof error === "object" && "code" in error && error.code === "ENOENT";
}

export { router as settingsRouter };
