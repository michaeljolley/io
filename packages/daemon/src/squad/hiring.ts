import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { createChildLogger } from '../logging/logger.js';
import { ensureSquadWiki } from '../wiki/index.js';
import { addMember, createSquad } from './manager.js';
import { generateSquadNames } from './name-generator.js';
import { QA_TESTER_SKILL, SCRIBE_SKILL, TEAM_LEAD_SKILL } from './roles/templates.js';
import { parseSkillContent } from './skill-parser.js';

const logger = () => createChildLogger('hiring');

interface ProjectAnalysis {
	name: string;
	languages: string[];
	frameworks: string[];
	hasTests: boolean;
	hasCi: boolean;
	suggestedSpecialists: string[];
}

/**
 * Analyze a project directory to determine what kind of squad it needs.
 */
export function analyzeProject(projectPath: string): ProjectAnalysis {
	const name = basename(projectPath);
	const languages: string[] = [];
	const frameworks: string[] = [];
	let hasTests = false;
	let hasCi = false;

	// Check for common project indicators
	const files = safeReadDir(projectPath);

	// Language detection
	if (files.includes('package.json')) {
		languages.push('TypeScript/JavaScript');
		const pkg = safeReadJson(join(projectPath, 'package.json'));
		if (pkg) {
			const deps = (pkg.dependencies ?? {}) as Record<string, string>;
			const devDeps = (pkg.devDependencies ?? {}) as Record<string, string>;
			const allDeps = { ...deps, ...devDeps };
			if (allDeps.react || allDeps['react-dom']) frameworks.push('React');
			if (allDeps.vue) frameworks.push('Vue');
			if (allDeps.svelte) frameworks.push('Svelte');
			if (allDeps.next) frameworks.push('Next.js');
			if (allDeps.express || allDeps.fastify || allDeps.koa) frameworks.push('Node.js Backend');
			if (allDeps.vitest || allDeps.jest || allDeps.mocha) hasTests = true;
		}
	}
	if (files.includes('Cargo.toml')) languages.push('Rust');
	if (files.includes('go.mod')) languages.push('Go');
	if (files.includes('requirements.txt') || files.includes('pyproject.toml'))
		languages.push('Python');
	if (files.includes('Gemfile')) languages.push('Ruby');
	if (files.some((f) => f.endsWith('.csproj') || f.endsWith('.sln'))) languages.push('C#/.NET');

	// CI detection
	if (files.includes('.github')) {
		const ghDir = safeReadDir(join(projectPath, '.github'));
		if (ghDir.includes('workflows')) hasCi = true;
	}

	// Suggest specialists based on detected tech
	const suggestedSpecialists: string[] = [];
	if (frameworks.includes('React') || frameworks.includes('Vue') || frameworks.includes('Svelte'))
		suggestedSpecialists.push('frontend-developer');
	if (frameworks.includes('Node.js Backend')) suggestedSpecialists.push('backend-developer');
	if (languages.includes('Rust')) suggestedSpecialists.push('rust-developer');
	if (languages.includes('Go')) suggestedSpecialists.push('go-developer');
	if (languages.includes('Python')) suggestedSpecialists.push('python-developer');
	if (languages.includes('C#/.NET')) suggestedSpecialists.push('dotnet-developer');

	// If no specialists detected, add a generic one
	if (suggestedSpecialists.length === 0 && languages.length > 0) {
		suggestedSpecialists.push('developer');
	}

	return { name, languages, frameworks, hasTests, hasCi, suggestedSpecialists };
}

/**
 * Generate a specialist SKILL.md from a role name and detected context.
 */
function generateSpecialistSkill(role: string, analysis: ProjectAnalysis): string {
	const langContext = analysis.languages.join(', ');
	const frameworkContext =
		analysis.frameworks.length > 0 ? `\nFrameworks: ${analysis.frameworks.join(', ')}` : '';

	return `---
role: ${role}
tools:
  - read_file
  - edit_file
  - run_command
  - search_code
veto: false
---

# ${titleCase(role)}

## Identity
You are a ${titleCase(role)} specializing in ${langContext}.${frameworkContext}

## Responsibilities
- Implement features and fix bugs assigned by the Team Lead
- Write clean, well-tested code following project conventions
- Run tests before submitting work for review
- Respond to code review feedback promptly

## Boundaries
- Only work on tasks assigned to you by the Team Lead
- Do NOT modify files outside your area of expertise unless directed
- Do NOT merge PRs — submit work for team lead review
- Always run the test suite before reporting task completion

## Project Context
Languages: ${langContext}${frameworkContext}
`;
}

/**
 * Execute the full squad hiring flow:
 * 1. Analyze the project
 * 2. Create the squad in DB
 * 3. Write SKILL.md files to disk
 * 4. Add all members
 */
export async function hireSquad(params: {
	projectPath: string;
	repoUrl?: string;
	name?: string;
	universe?: string;
}): Promise<{ squadId: string; analysis: ProjectAnalysis; members: string[]; universe: string }> {
	const log = logger();

	// 1. Analyze
	const analysis = analyzeProject(params.projectPath);
	const squadName = params.name ?? analysis.name;
	log.info({ squadName, analysis }, 'Project analyzed');

	// 2. Build skill files
	const skillsDir = join(homedir(), '.io', 'squads', squadName);
	mkdirSync(skillsDir, { recursive: true });

	const skillFiles: { role: string; content: string; veto: boolean }[] = [
		{ role: 'team-lead', content: TEAM_LEAD_SKILL, veto: true },
		{ role: 'scribe', content: SCRIBE_SKILL, veto: false },
		{ role: 'qa-tester', content: QA_TESTER_SKILL, veto: true },
	];

	for (const specialist of analysis.suggestedSpecialists) {
		skillFiles.push({
			role: specialist,
			content: generateSpecialistSkill(specialist, analysis),
			veto: false,
		});
	}

	// 3. Generate character names from universe via LLM
	const allRoles = skillFiles.map((f) => f.role);
	const generated = await generateSquadNames(allRoles, params.universe);
	log.info({ squadName, universe: generated.universe }, 'Universe names generated');

	// 4. Create squad
	const squad = await createSquad({
		name: squadName,
		projectPath: params.projectPath,
		repoUrl: params.repoUrl,
		universe: generated.universe,
	});

	// 5. Create wiki folder for this squad
	ensureSquadWiki(squadName);

	// 6. Write files and add members
	const memberRoles: string[] = [];
	for (const { role, content, veto } of skillFiles) {
		const filePath = join(skillsDir, `${role}.skill.md`);
		writeFileSync(filePath, content, 'utf-8');

		const skill = parseSkillContent(content, filePath);
		const assignment = generated.assignments.find((a) => a.role === role);
		const displayName = assignment?.displayName ?? role;
		const persona = assignment?.persona;
		await addMember({ squadId: squad.id, skill, displayName, persona, isVetoMember: veto });
		memberRoles.push(`${displayName} (${role})`);
	}

	log.info(
		{ squadId: squad.id, members: memberRoles, universe: generated.universe },
		'Squad hired successfully',
	);
	return { squadId: squad.id, analysis, members: memberRoles, universe: generated.universe };
}

// Helpers

function safeReadDir(dir: string): string[] {
	try {
		if (!existsSync(dir)) return [];
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function safeReadJson(path: string): Record<string, unknown> | null {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, 'utf-8'));
	} catch {
		return null;
	}
}

function titleCase(str: string): string {
	return str
		.split('-')
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}
