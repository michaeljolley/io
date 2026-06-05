import { Router } from "express";

import { getRecentActivity, getSquadActivity } from "../../store/index.js";

const router = Router();

router.get("/api/activity", async (req, res) => {
	try {
		const squadId = typeof req.query.squadId === "string" ? req.query.squadId : undefined;
		const limit = parsePositiveInteger(req.query.limit, 50);
		const offset = parseNonNegativeInteger(req.query.offset, 0);
		const activity = squadId
			? await getSquadActivity(squadId, limit, offset)
			: await getRecentActivity(limit, offset);

		res.status(200).json({
			data: activity,
			limit,
			offset,
			squadId: squadId ?? null,
		});
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch activity feed",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

function parsePositiveInteger(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value: unknown, fallback: number): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export { router as activityRouter };
