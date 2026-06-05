import type { CreateScheduleRequest, UpdateScheduleRequest } from "@io/shared";
import { Router } from "express";

import {
	createSchedule,
	deleteSchedule,
	getSchedule,
	listSchedules,
	updateSchedule,
} from "../../store/index.js";

const router = Router();

router.get("/api/schedules", async (_req, res) => {
	try {
		const schedules = await listSchedules();
		res.status(200).json(schedules);
	} catch (error) {
		res.status(500).json({
			error: "Failed to list schedules",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.get("/api/schedules/:id", async (req, res) => {
	try {
		const schedule = await getSchedule(req.params.id);
		if (!schedule) {
			res.status(404).json({ error: "Schedule not found" });
			return;
		}

		res.status(200).json(schedule);
	} catch (error) {
		res.status(500).json({
			error: "Failed to fetch schedule",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.post("/api/schedules", async (req, res) => {
	try {
		const body = req.body as CreateScheduleRequest | undefined;
		if (!body?.name?.trim() || !body?.cronExpression?.trim() || !body?.prompt?.trim()) {
			res.status(400).json({ error: "name, cronExpression, and prompt are required" });
			return;
		}

		const schedule = await createSchedule({
			name: body.name.trim(),
			cronExpression: body.cronExpression.trim(),
			prompt: body.prompt,
			enabled: body.enabled,
		});
		res.status(201).json(schedule);
	} catch (error) {
		res.status(isValidationError(error) ? 400 : 500).json({
			error: "Failed to create schedule",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.put("/api/schedules/:id", async (req, res) => {
	try {
		const body = (req.body ?? {}) as UpdateScheduleRequest;
		const schedule = await updateSchedule(req.params.id, {
			name: typeof body.name === "string" ? body.name.trim() : undefined,
			cronExpression:
				typeof body.cronExpression === "string" ? body.cronExpression.trim() : undefined,
			prompt: body.prompt,
			enabled: body.enabled,
		});

		if (!schedule) {
			res.status(404).json({ error: "Schedule not found" });
			return;
		}

		res.status(200).json(schedule);
	} catch (error) {
		res.status(isValidationError(error) ? 400 : 500).json({
			error: "Failed to update schedule",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

router.delete("/api/schedules/:id", async (req, res) => {
	try {
		const deleted = await deleteSchedule(req.params.id);
		if (!deleted) {
			res.status(404).json({ error: "Schedule not found" });
			return;
		}

		res.status(200).json({ deleted: true });
	} catch (error) {
		res.status(500).json({
			error: "Failed to delete schedule",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

function isValidationError(error: unknown): boolean {
	return error instanceof Error && /cron/i.test(error.message);
}

export { router as schedulesRouter };
