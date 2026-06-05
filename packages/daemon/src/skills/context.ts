import type { Skill } from "./loader.js";

export function getActiveSkillsContext(skills: Skill[]): string {
	if (skills.length === 0) {
		return "";
	}

	const sections = skills.map((skill) => `### ${skill.name}\n${skill.content}\n\n---`);
	return `## Skills\n\n${sections.join("\n\n")}\n`;
}

export function getSkillsForActivation(skills: Skill[], userMessage: string): Skill[] {
	const normalizedMessage = userMessage.toLowerCase();

	return skills.filter((skill) => {
		const activation = skill.activation.trim().toLowerCase();

		if (activation === "") {
			return false;
		}

		const activationKeywords = activation
			.split(/[\n,;|]+/)
			.map((keyword) => keyword.trim())
			.filter(Boolean);

		return activationKeywords.some((keyword) => normalizedMessage.includes(keyword));
	});
}
