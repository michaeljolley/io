import type { Config } from "../../config.js";
import type { ToolDefinition } from "../../copilot/session.js";

import { codingToolDefinitions, executeCodingToolCall } from "./coding.js";
import { executeInboxToolCall, inboxToolDefinitions } from "./inbox.js";
import { executeScheduleToolCall, scheduleToolDefinitions } from "./schedule.js";
import { executeSkillsToolCall, skillsToolDefinitions } from "./skills.js";
import {
	type OrchestratorToolExecutor,
	createSquadToolExecutor,
	squadToolDefinitions,
} from "./squad.js";
import { executeWikiToolCall, wikiToolDefinitions } from "./wiki.js";

export type { OrchestratorToolExecutor, OrchestratorToolResult } from "./squad.js";

export const orchestratorToolDefinitions: ToolDefinition[] = [
	...squadToolDefinitions,
	...wikiToolDefinitions,
	...scheduleToolDefinitions,
	...inboxToolDefinitions,
	...codingToolDefinitions,
	...skillsToolDefinitions,
];

export function createOrchestratorToolExecutor(config: Config): OrchestratorToolExecutor {
	const squadExecutor = createSquadToolExecutor(config);
	const executors: OrchestratorToolExecutor[] = [
		squadExecutor,
		executeWikiToolCall,
		executeScheduleToolCall,
		executeInboxToolCall,
		executeCodingToolCall,
		executeSkillsToolCall,
	];

	return async (toolName, args) => {
		let lastError: Error | null = null;
		for (const executor of executors) {
			try {
				return await executor(toolName, args);
			} catch (error) {
				if (error instanceof Error && error.message.startsWith("Unsupported ")) {
					lastError = error;
					continue;
				}
				throw error;
			}
		}
		throw lastError ?? new Error(`Unknown orchestrator tool: ${toolName}`);
	};
}

export function createBoundOrchestratorTools(config: Config): ToolDefinition[] {
	const executor = createOrchestratorToolExecutor(config);
	return orchestratorToolDefinitions.map((tool) => ({
		...tool,
		handler: async (args) => executor(tool.name, (args ?? {}) as Record<string, unknown>),
	}));
}
