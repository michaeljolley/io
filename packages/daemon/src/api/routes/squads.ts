import {
	EVENT_NAMES,
	type Objective,
	QA_MAX_REVISIONS,
	type SquadConfig,
	type SquadStatus,
	type UpdateSquadConfigRequest,
} from "@io/shared";
import { Router } from "express";

import { eventBus } from "../../event-bus.js";
import { asNullableString, asNumber, asString, getDatabase } from "../../store/db.js";
import {
	createObjective,
	createSquad,
	deleteSquad,
	getMembers,
	getSquad,
	listSquads,
	logActivity,
	updateSquad,
} from "../../store/index.js";

const router = Router();
const DEFAULT_CONFIG: SquadConfig = {
	prMode: "draft-pr",
	mcpServers: [],
	maxRevisions: QA_MAX_REVISIONS,
};

router.get("/api/squads", async (_req, res) => {
	try {
		res.status(200).json(await listSquads());
	} catch (error) {
		res.status(500).json({
			error: "Failed to list squads",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/squads/:id", async (req, res) => {
	try {
		const squad = await getSquad(req.params.id);
		if (!squad) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		res.status(200).json(squad);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch squad",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/squads", async (req, res) => {
	try {
		const body = (req.body ?? {}) as Record<string, unknown>;
		const name = typeof body.name === "string" ? body.name.trim() : "";
		const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : "";

		if (!name || !repoUrl) {
			res.status(400).json({ error: "name and repoUrl are required" });
			return;
		}

		const repoInfo = parseRepoInfo(
			repoUrl,
			typeof body.repoOwner === "string" ? body.repoOwner : undefined,
			typeof body.repoName === "string" ? body.repoName : undefined,
		);
		const squad = await createSquad({
			name,
			repoUrl,
			repoOwner: repoInfo.repoOwner,
			repoName: repoInfo.repoName,
			status: (typeof body.status === "string" ? body.status : undefined) as
				| SquadStatus
				| undefined,
			config: normalizeConfig(body.config),
		});

		await logActivity({
			squadId: squad.id,
			event: EVENT_NAMES.SQUAD_CREATED,
			description: `Created squad ${squad.name}`,
			metadata: { repoUrl: squad.repoUrl },
		});
		eventBus.emit(EVENT_NAMES.SQUAD_CREATED, { squad });
		res.status(201).json(squad);
	} catch (error) {
		res.status(isValidationError(error) ? 400 : 500).json({
			error: "Failed to create squad",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/squads/:id", async (req, res) => {
	try {
		const existing = await getSquad(req.params.id);
		if (!existing) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		const body = (req.body ?? {}) as Record<string, unknown>;
		const repoUrl = typeof body.repoUrl === "string" ? body.repoUrl.trim() : existing.repoUrl;
		const repoInfo = parseRepoInfo(
			repoUrl,
			typeof body.repoOwner === "string" ? body.repoOwner : existing.repoOwner,
			typeof body.repoName === "string" ? body.repoName : existing.repoName,
		);
		const updated = await updateSquad(req.params.id, {
			name: typeof body.name === "string" ? body.name.trim() : existing.name,
			repoUrl,
			repoOwner: repoInfo.repoOwner,
			repoName: repoInfo.repoName,
			status: (typeof body.status === "string" ? body.status : existing.status) as SquadStatus,
			config: mergeConfig(
				existing.config,
				body.config as UpdateSquadConfigRequest | SquadConfig | undefined,
			),
		});

		if (!updated) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		await logActivity({
			squadId: updated.id,
			event: EVENT_NAMES.SQUAD_UPDATED,
			description: `Updated squad ${updated.name}`,
			metadata: { repoUrl: updated.repoUrl },
		});
		eventBus.emit(EVENT_NAMES.SQUAD_UPDATED, { squad: updated });
		res.status(200).json(updated);
	} catch (error) {
		res.status(isValidationError(error) ? 400 : 500).json({
			error: "Failed to update squad",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/api/squads/:id", async (req, res) => {
	try {
		const existing = await getSquad(req.params.id);
		if (!existing) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		const deleted = await deleteSquad(req.params.id);
		if (!deleted) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		await logActivity({
			squadId: existing.id,
			event: EVENT_NAMES.SQUAD_DELETED,
			description: `Deleted squad ${existing.name}`,
			metadata: { repoUrl: existing.repoUrl },
		});
		eventBus.emit(EVENT_NAMES.SQUAD_DELETED, { squadId: existing.id });
		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to delete squad",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/squads/:id/members", async (req, res) => {
	try {
		const squad = await getSquad(req.params.id);
		if (!squad) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		res.status(200).json(await getMembers(req.params.id));
	} catch (error) {
		res.status(500).json({
			error: "Failed to list squad members",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/squads/:id/objectives", async (req, res) => {
	try {
		const squad = await getSquad(req.params.id);
		if (!squad) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		const description =
			typeof req.body?.description === "string" ? req.body.description.trim() : "";
		if (!description) {
			res.status(400).json({ error: "description is required" });
			return;
		}

		const objective = await createObjective(req.params.id, description);
		await logActivity({
			squadId: squad.id,
			objectiveId: objective.id,
			event: "objective.created",
			description,
		});
		res.status(201).json(objective);
	} catch (error) {
		res.status(500).json({
			error: "Failed to create objective",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/squads/:id/objectives", async (req, res) => {
	try {
		const squad = await getSquad(req.params.id);
		if (!squad) {
			res.status(404).json({ error: "Squad not found" });
			return;
		}

		res.status(200).json(await listObjectivesForSquad(req.params.id));
	} catch (error) {
		res.status(500).json({
			error: "Failed to list squad objectives",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

async function listObjectivesForSquad(squadId: string): Promise<Objective[]> {
	const database = await getDatabase();
	const result = await database.execute({
		sql: "SELECT * FROM objectives WHERE squad_id = ? ORDER BY updated_at DESC, created_at DESC, id DESC",
		args: [squadId],
	});

	return result.rows.map((row) => ({
		id: asString(row.id),
		squadId: asString(row.squad_id),
		description: asString(row.description),
		status: asString(row.status) as Objective["status"],
		plan: asNullableString(row.plan),
		revisionCount: asNumber(row.revision_count),
		branch: asNullableString(row.branch),
		prUrl: asNullableString(row.pr_url),
		createdAt: asString(row.created_at),
		updatedAt: asString(row.updated_at),
	}));
}

function normalizeConfig(input: unknown): SquadConfig {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return { ...DEFAULT_CONFIG };
	}

	return mergeConfig(DEFAULT_CONFIG, input as UpdateSquadConfigRequest | SquadConfig);
}

function mergeConfig(
	baseConfig: SquadConfig,
	updates: UpdateSquadConfigRequest | SquadConfig | undefined,
): SquadConfig {
	if (!updates || typeof updates !== "object") {
		return { ...baseConfig };
	}

	const nextConfig: SquadConfig = {
		prMode: typeof updates.prMode === "string" ? updates.prMode : baseConfig.prMode,
		mcpServers: Array.isArray(updates.mcpServers)
			? updates.mcpServers.filter((server): server is string => typeof server === "string")
			: baseConfig.mcpServers,
		maxRevisions:
			"maxRevisions" in updates &&
			typeof updates.maxRevisions === "number" &&
			updates.maxRevisions > 0
				? updates.maxRevisions
				: baseConfig.maxRevisions,
	};

	if (!nextConfig.prMode) {
		throw new Error("Invalid squad config");
	}

	return nextConfig;
}

function parseRepoInfo(
	repoUrl: string,
	repoOwner?: string,
	repoName?: string,
): { repoOwner: string; repoName: string } {
	if (repoOwner?.trim() && repoName?.trim()) {
		return { repoOwner: repoOwner.trim(), repoName: repoName.trim() };
	}

	const url = new URL(repoUrl);
	const segments = url.pathname
		.replace(/\.git$/i, "")
		.split("/")
		.filter(Boolean);
	if (segments.length < 2) {
		throw new Error("repoUrl must include owner and repository name");
	}

	return {
		repoOwner: repoOwner?.trim() || segments[0],
		repoName: repoName?.trim() || segments[1],
	};
}

function isValidationError(error: unknown): boolean {
	return error instanceof Error && /repoUrl|config|Invalid URL/i.test(error.message);
}

export { router as squadsRouter };
