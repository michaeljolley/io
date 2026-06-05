import { z } from "zod";

import type { ToolDefinition } from "../../copilot/session.js";
import {
	createSchedule,
	deleteSchedule,
	listSchedules,
	updateSchedule,
} from "../../store/index.js";

import type { OrchestratorToolExecutor } from "./squad.js";

const scheduleCreateSchema = z.object({
	name: z.string().trim().min(1),
	cronExpression: z.string().trim().min(1),
	prompt: z.string().trim().min(1),
});

const scheduleUpdateSchema = z.object({
	id: z.string().trim().min(1),
	name: z.string().trim().min(1).optional(),
	cronExpression: z.string().trim().min(1).optional(),
	prompt: z.string().trim().min(1).optional(),
	enabled: z.boolean().optional(),
});

const scheduleDeleteSchema = z.object({
	id: z.string().trim().min(1),
});

export const scheduleToolDefinitions: ToolDefinition[] = [
	{
		name: "schedule_create",
		description: "Create a schedule.",
		parameters: scheduleCreateSchema,
		skipPermission: true,
	},
	{
		name: "schedule_update",
		description: "Update a schedule.",
		parameters: scheduleUpdateSchema,
		skipPermission: true,
	},
	{
		name: "schedule_delete",
		description: "Delete a schedule.",
		parameters: scheduleDeleteSchema,
		skipPermission: true,
	},
	{
		name: "schedule_list",
		description: "List all schedules.",
		parameters: z.object({}),
		skipPermission: true,
	},
];

export const executeScheduleToolCall: OrchestratorToolExecutor = async (toolName, rawArgs) => {
	switch (toolName) {
		case "schedule_create": {
			const args = scheduleCreateSchema.parse(rawArgs);
			const schedule = await createSchedule(args);
			return { message: `Created schedule ${schedule.name}.`, schedule };
		}
		case "schedule_update": {
			const { id, ...updates } = scheduleUpdateSchema.parse(rawArgs);
			const schedule = await updateSchedule(id, updates);
			if (!schedule) {
				throw new Error(`Schedule ${id} was not found.`);
			}
			return { message: `Updated schedule ${schedule.name}.`, schedule };
		}
		case "schedule_delete": {
			const { id } = scheduleDeleteSchema.parse(rawArgs);
			const deleted = await deleteSchedule(id);
			if (!deleted) {
				throw new Error(`Schedule ${id} was not found.`);
			}
			return { message: `Deleted schedule ${id}.`, id };
		}
		case "schedule_list": {
			const schedules = await listSchedules();
			return {
				message:
					schedules.length > 0
						? `Found ${schedules.length} schedule(s).`
						: "No schedules are configured.",
				schedules,
			};
		}
		default:
			throw new Error(`Unsupported schedule tool: ${toolName}`);
	}
};
