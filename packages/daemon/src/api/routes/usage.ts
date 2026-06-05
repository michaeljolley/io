import type { UsageQueryParams } from "@io/shared";
import { Router } from "express";

import { getDailyUsage, getUsageSummary } from "../../store/index.js";

const router = Router();

router.get("/api/usage", async (req, res) => {
	try {
		const params = getUsageParams(req.query);
		const summary = await getUsageSummary(params);
		res.status(200).json(summary);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch usage summary",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/usage/daily", async (req, res) => {
	try {
		const params = getUsageParams(req.query);
		const daily = await getDailyUsage(params.startDate ?? null, params.endDate ?? null, {
			squadId: params.squadId,
			agentId: params.agentId,
			model: params.model,
		});
		res.status(200).json(daily);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch daily usage",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

function getUsageParams(query: Record<string, unknown>): UsageQueryParams {
	return {
		startDate: typeof query.startDate === "string" ? query.startDate : undefined,
		endDate: typeof query.endDate === "string" ? query.endDate : undefined,
		squadId: typeof query.squadId === "string" ? query.squadId : undefined,
		agentId: typeof query.agentId === "string" ? query.agentId : undefined,
		model: typeof query.model === "string" ? query.model : undefined,
	};
}

export { router as usageRouter };
