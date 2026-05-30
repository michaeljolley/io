export { EventBus, getEventBus } from './event-bus.js';
export { parseSkillFile, parseSkillContent, compileSystemPrompt } from './skill-parser.js';
export type { SkillDefinition } from './skill-parser.js';
export { Agent } from './agent.js';
export type { AgentConfig } from './agent.js';
export {
	createSquad,
	addMember,
	listSquads,
	getSquadByName,
	getSquadMembers,
	disbandSquad,
	bootSquad,
	getSquadRuntime,
	delegateToSquad,
} from './manager.js';
export { hireSquad, analyzeProject } from './hiring.js';
