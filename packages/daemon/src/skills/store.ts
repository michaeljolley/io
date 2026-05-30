import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChildLogger } from '../logging/logger.js';
import { getDatabase } from '../store/db.js';

const logger = () => createChildLogger('skills');

export interface Skill {
	name: string;
	content: string;
	filePath: string;
}

export interface SkillActivation {
	skillName: string;
	targetType: 'orchestrator' | 'squad';
	targetId: string | null;
	activatedAt: string;
}

let skillsRoot = '';

/**
 * Initialize the skills directory.
 */
export function initSkills(dataDir: string): void {
	skillsRoot = join(dataDir, 'skills');
	mkdirSync(skillsRoot, { recursive: true });
	logger().info({ skillsRoot }, 'Skills directory initialized');
}

/**
 * List all installed skills.
 */
export function listInstalledSkills(): Skill[] {
	if (!existsSync(skillsRoot)) return [];

	const dirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((d) => d.isDirectory());

	const skills: Skill[] = [];
	for (const dir of dirs) {
		const skillPath = join(skillsRoot, dir.name, 'SKILL.md');
		if (existsSync(skillPath)) {
			skills.push({
				name: dir.name,
				content: readFileSync(skillPath, 'utf-8'),
				filePath: skillPath,
			});
		}
	}
	return skills;
}

/**
 * Read a specific skill by name.
 */
export function getSkill(name: string): Skill | null {
	const skillPath = join(skillsRoot, name, 'SKILL.md');
	if (!existsSync(skillPath)) return null;
	return {
		name,
		content: readFileSync(skillPath, 'utf-8'),
		filePath: skillPath,
	};
}

/**
 * Install a skill from content (e.g., fetched from URL or provided directly).
 */
export function installSkill(name: string, content: string): Skill {
	const skillDir = join(skillsRoot, name);
	mkdirSync(skillDir, { recursive: true });
	const skillPath = join(skillDir, 'SKILL.md');
	writeFileSync(skillPath, content, 'utf-8');
	logger().info({ name }, 'Skill installed');
	return { name, content, filePath: skillPath };
}

/**
 * Install a skill from a URL (fetches raw content).
 */
export async function installSkillFromUrl(name: string, url: string): Promise<Skill> {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch skill from ${url}: ${res.status} ${res.statusText}`);
	}
	const content = await res.text();
	return installSkill(name, content);
}

/**
 * Remove an installed skill.
 */
export function removeSkill(name: string): void {
	const skillDir = join(skillsRoot, name);
	if (existsSync(skillDir)) {
		rmSync(skillDir, { recursive: true });
		logger().info({ name }, 'Skill removed');
	}
	// Also remove all activations
	deactivateSkillAll(name);
}

/**
 * Activate a skill for a target (orchestrator or a specific squad).
 */
export async function activateSkill(
	skillName: string,
	targetType: 'orchestrator' | 'squad',
	targetId?: string,
): Promise<void> {
	const db = await getDatabase();
	await db.execute({
		sql: `INSERT OR IGNORE INTO skill_activations (skill_name, target_type, target_id, activated_at)
		      VALUES (?, ?, ?, datetime('now'))`,
		args: [skillName, targetType, targetId ?? null],
	});
	logger().info({ skillName, targetType, targetId }, 'Skill activated');
}

/**
 * Deactivate a skill for a target.
 */
export async function deactivateSkill(
	skillName: string,
	targetType: 'orchestrator' | 'squad',
	targetId?: string,
): Promise<void> {
	const db = await getDatabase();
	await db.execute({
		sql: 'DELETE FROM skill_activations WHERE skill_name = ? AND target_type = ? AND (target_id = ? OR (target_id IS NULL AND ? IS NULL))',
		args: [skillName, targetType, targetId ?? null, targetId ?? null],
	});
	logger().info({ skillName, targetType, targetId }, 'Skill deactivated');
}

/**
 * Remove all activations for a skill.
 */
async function deactivateSkillAll(skillName: string): Promise<void> {
	const db = await getDatabase();
	await db.execute({
		sql: 'DELETE FROM skill_activations WHERE skill_name = ?',
		args: [skillName],
	});
}

/**
 * Get all activations for a target.
 */
export async function getActiveSkills(
	targetType: 'orchestrator' | 'squad',
	targetId?: string,
): Promise<SkillActivation[]> {
	const db = await getDatabase();
	const result = await db.execute({
		sql: `SELECT skill_name, target_type, target_id, activated_at FROM skill_activations
		      WHERE target_type = ? AND (target_id = ? OR (target_id IS NULL AND ? IS NULL))`,
		args: [targetType, targetId ?? null, targetId ?? null],
	});
	return result.rows.map((r) => ({
		skillName: r.skill_name as string,
		targetType: r.target_type as 'orchestrator' | 'squad',
		targetId: r.target_id as string | null,
		activatedAt: r.activated_at as string,
	}));
}

/**
 * Get the combined content of all active skills for a target (for system prompt injection).
 */
export async function getActiveSkillsContent(
	targetType: 'orchestrator' | 'squad',
	targetId?: string,
): Promise<string> {
	const activations = await getActiveSkills(targetType, targetId);
	if (activations.length === 0) return '';

	const sections: string[] = [];
	for (const activation of activations) {
		const skill = getSkill(activation.skillName);
		if (skill) {
			sections.push(`### Skill: ${skill.name}\n${skill.content}`);
		}
	}

	return sections.length > 0 ? `\n## Active Skills\n${sections.join('\n\n')}` : '';
}
