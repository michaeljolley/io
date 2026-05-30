import { existsSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { getActiveSkillsContent } from '../skills/index.js';
import { getPageListing, getSquadScopes } from '../wiki/index.js';

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
export async function compileSystemPrompt(
	skill: SkillDefinition,
	squadContext?: string,
	squadName?: string,
	squadId?: string,
	identity?: { displayName: string; persona?: string; universe?: string },
): Promise<string> {
	const parts: string[] = [];

	if (identity?.displayName && identity.displayName !== skill.role) {
		const intro = `You are ${identity.displayName}${identity.universe ? ` from ${identity.universe}` : ''}, the ${skill.role} agent in an IO squad.`;
		parts.push(intro);
		if (identity.persona) {
			parts.push(identity.persona);
		}
	} else {
		parts.push(`You are the ${skill.role} agent in an IO squad.`);
	}

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

	// Inject wiki page listing so agents know what knowledge is available
	if (squadName) {
		const wikiListing = getPageListing(getSquadScopes(squadName));
		parts.push(
			`\n## Wiki Knowledge\n${wikiListing}\n\nUse read_wiki to access page content. Use write_wiki to record important project knowledge.`,
		);
	}

	// Inject active skills for this squad
	if (squadId) {
		const skillsContent = await getActiveSkillsContent('squad', squadId);
		if (skillsContent) {
			parts.push(skillsContent);
		}
	}

	return parts.join('\n');
}
