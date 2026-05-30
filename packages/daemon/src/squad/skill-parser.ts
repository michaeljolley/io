import { existsSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';

export interface SkillDefinition {
	role: string;
	tools: string[];
	veto: boolean;
	systemPrompt: string;
	rawMarkdown: string;
	filePath: string;
}

interface SkillFrontmatter {
	role: string;
	tools?: string[];
	veto?: boolean;
}

/**
 * Parse a SKILL.md file into a structured SkillDefinition.
 * Format:
 * ---
 * role: react-developer
 * tools:
 *   - edit_file
 *   - read_file
 * veto: false
 * ---
 * # Role Name
 * System prompt markdown content...
 */
export function parseSkillFile(filePath: string): SkillDefinition {
	if (!existsSync(filePath)) {
		throw new Error(`SKILL.md not found: ${filePath}`);
	}

	const raw = readFileSync(filePath, 'utf-8');
	return parseSkillContent(raw, filePath);
}

/**
 * Parse SKILL.md content string into a SkillDefinition.
 */
export function parseSkillContent(content: string, filePath = '<inline>'): SkillDefinition {
	const { data, content: body } = matter(content);
	const frontmatter = data as SkillFrontmatter;

	if (!frontmatter.role) {
		throw new Error(`SKILL.md missing required 'role' in frontmatter: ${filePath}`);
	}

	return {
		role: frontmatter.role,
		tools: frontmatter.tools ?? [],
		veto: frontmatter.veto ?? false,
		systemPrompt: body.trim(),
		rawMarkdown: content,
		filePath,
	};
}

/**
 * Compile a SkillDefinition into a full system message string for the LLM.
 * Injects role identity, boundaries, and tool context.
 */
export function compileSystemPrompt(skill: SkillDefinition, squadContext?: string): string {
	const parts: string[] = [];

	parts.push(`You are the ${skill.role} agent in an IO squad.`);

	if (squadContext) {
		parts.push(`\n## Squad Context\n${squadContext}`);
	}

	parts.push(`\n## Your Role\n${skill.systemPrompt}`);

	if (skill.tools.length > 0) {
		parts.push(`\n## Allowed Tools\nYou may ONLY use: ${skill.tools.join(', ')}`);
	}

	if (skill.veto) {
		parts.push(
			'\n## Veto Power\nYou have veto power in meetings. Use it when you identify critical issues.',
		);
	}

	return parts.join('\n');
}
