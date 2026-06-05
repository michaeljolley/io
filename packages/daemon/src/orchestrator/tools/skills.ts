import { z } from "zod";

import type { ToolDefinition } from "../../copilot/session.js";
import { scanSkills } from "../../skills/loader.js";
import { installSkill, listInstalledSkills, removeSkill } from "../../skills/manager.js";

import type { OrchestratorToolExecutor } from "./squad.js";

const searchSkillsSchema = z.object({
	query: z.string().trim().min(1),
});

const installSkillSchema = z.object({
	url: z.string().trim().url(),
});

const removeSkillSchema = z.object({
	id: z.string().trim().min(1),
});

export const skillsToolDefinitions: ToolDefinition[] = [
	{
		name: "search_skills",
		description: "Search available skills.",
		parameters: searchSkillsSchema,
		skipPermission: true,
	},
	{
		name: "install_skill",
		description: "Install a skill from a URL.",
		parameters: installSkillSchema,
		skipPermission: true,
	},
	{
		name: "remove_skill",
		description: "Remove an installed skill.",
		parameters: removeSkillSchema,
		skipPermission: true,
	},
	{
		name: "list_skills",
		description: "List installed skills.",
		parameters: z.object({}),
		skipPermission: true,
	},
];

function scoreSkill(
	skill: { name: string; description: string; activation: string; content: string },
	query: string,
): number {
	const normalizedQuery = query.toLowerCase();
	let score = 0;
	if (skill.name.toLowerCase().includes(normalizedQuery)) {
		score += 100;
	}
	if (skill.description.toLowerCase().includes(normalizedQuery)) {
		score += 50;
	}
	if (skill.activation.toLowerCase().includes(normalizedQuery)) {
		score += 30;
	}
	if (skill.content.toLowerCase().includes(normalizedQuery)) {
		score += 10;
	}
	return score;
}

export const executeSkillsToolCall: OrchestratorToolExecutor = async (toolName, rawArgs) => {
	switch (toolName) {
		case "search_skills": {
			const { query } = searchSkillsSchema.parse(rawArgs);
			const skills = await scanSkills();
			const matches = skills
				.map((skill) => ({ skill, score: scoreSkill(skill, query) }))
				.filter((entry) => entry.score > 0)
				.sort(
					(left, right) =>
						right.score - left.score || left.skill.name.localeCompare(right.skill.name),
				)
				.slice(0, 10)
				.map((entry) => entry.skill);
			return {
				message:
					matches.length > 0
						? `Found ${matches.length} matching skill(s).`
						: "No skills matched the query.",
				skills: matches,
			};
		}
		case "install_skill": {
			const { url } = installSkillSchema.parse(rawArgs);
			const skill = await installSkill(url);
			return { message: `Installed skill ${skill.name}.`, skill };
		}
		case "remove_skill": {
			const { id } = removeSkillSchema.parse(rawArgs);
			await removeSkill(id);
			return { message: `Removed skill ${id}.`, id };
		}
		case "list_skills": {
			const skills = await listInstalledSkills();
			return {
				message:
					skills.length > 0
						? `Found ${skills.length} installed skill(s).`
						: "No skills are installed.",
				skills,
			};
		}
		default:
			throw new Error(`Unsupported skills tool: ${toolName}`);
	}
};
