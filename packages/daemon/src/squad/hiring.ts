import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { loadConfig } from '../config.js';
import { getClient } from '../copilot/client.js';
import { buildProvider } from '../copilot/provider.js';
import { createChildLogger } from '../logging/logger.js';
import { ensureSquadWiki } from '../wiki/index.js';
import { addMember, createSquad } from './manager.js';
import { generateSquadNames } from './name-generator.js';
import { QA_TESTER_SKILL, SCRIBE_SKILL, TECHNICAL_PM_SKILL } from './roles/templates.js';
import { parseSkillContent } from './skill-parser.js';

const logger = () => createChildLogger('hiring');

// ─── Proposal Storage ───────────────────────────────────────────────────────

export interface ProposedMember {
	role: string;
	title: string;
	justification: string;
	isCore: boolean;
	veto: boolean;
	displayName?: string;
	persona?: string;
}

export interface SquadProposal {
	id: string;
	repoUrl: string;
	projectPath: string;
	projectName: string;
	universe: string;
	members: ProposedMember[];
	createdAt: number;
}

const proposals = new Map<string, SquadProposal>();

export function getProposal(id: string): SquadProposal | undefined {
	return proposals.get(id);
}

export function getProposalByRepo(repoUrl: string): SquadProposal | undefined {
	for (const proposal of proposals.values()) {
		if (proposal.repoUrl === repoUrl) return proposal;
	}
	return undefined;
}

export function deleteProposal(id: string): void {
	proposals.delete(id);
}

// ─── LLM Codebase Analyzer ─────────────────────────────────────────────────

const ANALYZER_PROMPT = `You are a senior engineering hiring manager. Given a codebase summary, recommend the specialist roles needed for a high-performing engineering squad.

Rules:
- Roles must be SENIOR or PRINCIPAL level — no junior, mid-level, or generic titles
- Roles must be SPECIFIC to the technology stack (e.g., "Senior React/Vite Engineer", not "Frontend Developer")
- Recommend 2-5 specialist roles depending on project complexity
- Consider: languages, frameworks, architecture patterns, testing needs, deployment complexity
- Include a justification for each role explaining WHY the project needs that specific specialist
- Decide whether QA and Testing should be separate roles based on project size/complexity. For small projects, one QA/Test Engineer suffices. For large projects with multiple test layers (unit, integration, e2e, performance), recommend separate QA Engineer and Tester.
- Return ONLY valid JSON, no markdown fencing

Respond with this exact JSON structure:
{
  "specialists": [
    { "role": "<kebab-case-role-id>", "title": "<Senior/Principal Level Title>", "justification": "<why this project needs this role>" }
  ],
  "separateQaAndTester": true/false,
  "qaJustification": "<why QA and Tester should or should not be separate>"
}`;

interface CodebaseSummary {
	name: string;
	readme: string;
	manifests: Record<string, string>;
	configFiles: string[];
	directoryTree: string;
	ciFiles: string[];
}

/**
 * Sample key files from the project to build a codebase summary for the LLM.
 */
function sampleCodebase(projectPath: string): CodebaseSummary {
	const name = basename(projectPath);
	const files = safeReadDir(projectPath);

	const readmeFile = files.find((f) => f.toLowerCase().startsWith('readme'));
	const readme = readmeFile ? safeReadFile(join(projectPath, readmeFile), 4000) : '';
	const manifests = collectManifests(projectPath, files);
	const configFiles = detectConfigFiles(files);
	const directoryTree = buildDirectoryTree(projectPath, 2, 60);
	const ciFiles = collectCiFiles(projectPath);

	return { name, readme, manifests, configFiles, directoryTree, ciFiles };
}

const MANIFEST_FILES = [
	'package.json',
	'Cargo.toml',
	'go.mod',
	'pyproject.toml',
	'requirements.txt',
	'Gemfile',
	'pom.xml',
	'build.gradle',
];

function collectManifests(projectPath: string, files: string[]): Record<string, string> {
	const manifests: Record<string, string> = {};
	for (const mf of MANIFEST_FILES) {
		if (files.includes(mf)) {
			manifests[mf] = safeReadFile(join(projectPath, mf), 2000);
		}
	}
	// Check for workspace/monorepo manifests
	for (const sub of ['packages', 'apps', 'libs']) {
		const subPath = join(projectPath, sub);
		if (!existsSync(subPath)) continue;
		const subContents = safeReadDir(subPath);
		for (const pkg of subContents.slice(0, 8)) {
			const pkgManifest = join(subPath, pkg, 'package.json');
			if (existsSync(pkgManifest)) {
				manifests[`${sub}/${pkg}/package.json`] = safeReadFile(pkgManifest, 1000);
			}
		}
	}
	return manifests;
}

const CONFIG_PATTERNS = [
	'tsconfig.json',
	'vite.config',
	'webpack.config',
	'next.config',
	'tailwind.config',
	'docker-compose',
	'Dockerfile',
	'.env.example',
	'biome.json',
	'eslint',
];

function detectConfigFiles(files: string[]): string[] {
	return files.filter((f) =>
		CONFIG_PATTERNS.some((p) => f.toLowerCase().includes(p.toLowerCase())),
	);
}

function collectCiFiles(projectPath: string): string[] {
	const ciFiles: string[] = [];
	const ghWorkflows = join(projectPath, '.github', 'workflows');
	if (existsSync(ghWorkflows)) {
		const workflows = safeReadDir(ghWorkflows);
		for (const wf of workflows.slice(0, 3)) {
			ciFiles.push(safeReadFile(join(ghWorkflows, wf), 1000));
		}
	}
	return ciFiles;
}

/**
 * Use the LLM to analyze a codebase and recommend specialist roles.
 */
async function analyzeCodebase(projectPath: string): Promise<{
	specialists: { role: string; title: string; justification: string }[];
	separateQaAndTester: boolean;
}> {
	const log = logger();
	const summary = sampleCodebase(projectPath);

	const userMessage = `Here is a summary of the "${summary.name}" project:

## README (truncated)
${summary.readme || '(no README found)'}

## Package Manifests
${Object.entries(summary.manifests)
	.map(([f, content]) => `### ${f}\n\`\`\`\n${content}\n\`\`\``)
	.join('\n\n')}

## Config Files Present
${summary.configFiles.join(', ') || '(none detected)'}

## Directory Structure
\`\`\`
${summary.directoryTree}
\`\`\`

## CI/CD Workflows
${summary.ciFiles.length > 0 ? summary.ciFiles.map((c) => `\`\`\`yaml\n${c}\n\`\`\``).join('\n') : '(none found)'}

Based on this codebase, what senior/principal-level specialist roles does this project need?`;

	try {
		const config = loadConfig();
		const provider = buildProvider(config.byok);
		const client = await getClient();
		const session = await client.createSession({
			model: config.defaultModel,
			systemMessage: { mode: 'replace' as const, content: ANALYZER_PROMPT },
			...(provider && { provider }),
		});

		const result = await session.sendAndWait({ prompt: userMessage }, 90_000);
		const accumulated = result?.data?.content ?? '';

		const parsed = extractJson(accumulated);
		if (!parsed || !Array.isArray(parsed.specialists)) {
			throw new Error('Invalid LLM response for codebase analysis');
		}

		log.info(
			{
				project: summary.name,
				specialists: (parsed.specialists as { title: string }[]).map((s) => s.title),
				separateQa: parsed.separateQaAndTester,
			},
			'Codebase analyzed',
		);

		return {
			specialists: parsed.specialists as { role: string; title: string; justification: string }[],
			separateQaAndTester: !!parsed.separateQaAndTester,
		};
	} catch (err) {
		log.error({ err }, 'LLM codebase analysis failed, using fallback heuristics');
		return fallbackAnalysis(projectPath);
	}
}

// ─── Propose / Confirm Flow ────────────────────────────────────────────────

/**
 * Propose a squad: clone, analyze, generate names, store proposal for review.
 */
export async function proposeSquad(params: {
	projectPath: string;
	repoUrl?: string;
	name?: string;
	universe?: string;
}): Promise<SquadProposal> {
	const log = logger();
	const projectName = params.name ?? basename(params.projectPath);

	// 1. Analyze with LLM
	const analysis = await analyzeCodebase(params.projectPath);

	// 2. Build member list — core roles + specialists
	const members: ProposedMember[] = [
		{
			role: 'technical-pm',
			title: 'Technical PM',
			justification: 'Coordinates the team, makes architectural decisions, reviews all work',
			isCore: true,
			veto: true,
		},
		{
			role: 'scribe',
			title: 'Scribe',
			justification: 'Records decisions, maintains documentation, writes PR descriptions',
			isCore: true,
			veto: false,
		},
	];

	if (analysis.separateQaAndTester) {
		members.push({
			role: 'qa-engineer',
			title: 'QA Engineer',
			justification:
				'Quality gate — reviews code for edge cases, security issues, and test coverage',
			isCore: true,
			veto: true,
		});
		members.push({
			role: 'tester',
			title: 'Tester',
			justification: 'Functional/integration testing, CI/CD pipeline verification, test automation',
			isCore: true,
			veto: false,
		});
	} else {
		members.push({
			role: 'qa-tester',
			title: 'QA/Test Engineer',
			justification: 'Quality gate — writes tests, reviews for edge cases, blocks bad merges',
			isCore: true,
			veto: true,
		});
	}

	for (const spec of analysis.specialists) {
		members.push({
			role: spec.role,
			title: spec.title,
			justification: spec.justification,
			isCore: false,
			veto: false,
		});
	}

	// 3. Generate character names
	const allRoles = members.map((m) => m.title);
	const generated = await generateSquadNames(allRoles, params.universe);

	// Assign names to members
	for (const member of members) {
		const assignment = generated.assignments.find(
			(a) => a.role.toLowerCase() === member.title.toLowerCase(),
		);
		if (assignment) {
			member.displayName = assignment.displayName;
			member.persona = assignment.persona;
		}
	}

	// 4. Store proposal
	const proposalId = crypto.randomUUID();
	const resolvedUniverse = params.universe ?? generated.universe;
	const proposal: SquadProposal = {
		id: proposalId,
		repoUrl: params.repoUrl ?? '',
		projectPath: params.projectPath,
		projectName,
		universe: resolvedUniverse,
		members,
		createdAt: Date.now(),
	};
	proposals.set(proposalId, proposal);

	log.info(
		{
			proposalId,
			projectName,
			universe: resolvedUniverse,
			memberCount: members.length,
		},
		'Squad proposal created',
	);

	return proposal;
}

/**
 * Confirm a squad proposal and create the actual squad.
 */
export async function confirmSquad(params: {
	proposalId: string;
	name?: string;
	removedRoles?: string[];
}): Promise<{ squadId: string; members: string[]; universe: string }> {
	const log = logger();
	const proposal = proposals.get(params.proposalId);
	if (!proposal) {
		throw new Error(`Proposal '${params.proposalId}' not found or has expired.`);
	}

	const squadName = params.name ?? proposal.projectName;
	const removedSet = new Set(params.removedRoles?.map((r) => r.toLowerCase()) ?? []);
	const finalMembers = proposal.members.filter((m) => !removedSet.has(m.role.toLowerCase()));

	// 1. Create skill files directory
	const skillsDir = join(homedir(), '.io', 'squads', squadName);
	mkdirSync(skillsDir, { recursive: true });

	// 2. Create the squad
	const squad = await createSquad({
		name: squadName,
		projectPath: proposal.projectPath,
		repoUrl: proposal.repoUrl || undefined,
		universe: proposal.universe,
	});

	// 3. Create wiki
	ensureSquadWiki(squadName);

	// 4. Write skill files and add members
	const memberRoles: string[] = [];
	for (const member of finalMembers) {
		const skillContent = generateSkillForMember(member, proposal.projectPath);
		const filePath = join(skillsDir, `${member.role}.skill.md`);
		writeFileSync(filePath, skillContent, 'utf-8');

		const skill = parseSkillContent(skillContent, filePath);
		await addMember({
			squadId: squad.id,
			skill,
			displayName: member.displayName ?? member.title,
			persona: member.persona,
			isVetoMember: member.veto,
		});
		memberRoles.push(`${member.displayName ?? member.title} (${member.title})`);
	}

	// 5. Clean up proposal
	proposals.delete(params.proposalId);

	log.info(
		{ squadId: squad.id, members: memberRoles, universe: proposal.universe },
		'Squad confirmed and created',
	);

	return { squadId: squad.id, members: memberRoles, universe: proposal.universe };
}

// ─── Legacy API (kept for addMemberToExistingSquad) ─────────────────────────

/**
 * Add a new member to an existing squad.
 * Generates a skill file and optionally themes the name to the squad's universe.
 */
export async function addMemberToExistingSquad(params: {
	squadId: string;
	squadName: string;
	role: string;
	projectPath: string;
	universe?: string;
}): Promise<{ displayName: string; role: string }> {
	const log = logger();

	const member: ProposedMember = {
		role: params.role,
		title: titleCase(params.role),
		justification: '',
		isCore: false,
		veto: params.role.includes('qa'),
	};

	const skillContent = generateSkillForMember(member, params.projectPath);
	const skillsDir = join(homedir(), '.io', 'squads', params.squadName);
	mkdirSync(skillsDir, { recursive: true });
	const filePath = join(skillsDir, `${params.role}.skill.md`);
	writeFileSync(filePath, skillContent, 'utf-8');

	const skill = parseSkillContent(skillContent, filePath);

	// Generate themed name if universe is set
	let displayName = member.title;
	let persona: string | undefined;
	if (params.universe) {
		const generated = await generateSquadNames([params.role], params.universe);
		const assignment = generated.assignments[0];
		if (assignment) {
			displayName = assignment.displayName;
			persona = assignment.persona;
		}
	}

	await addMember({
		squadId: params.squadId,
		skill,
		displayName,
		persona,
		isVetoMember: member.veto,
	});

	log.info({ squadId: params.squadId, role: params.role, displayName }, 'Member added to squad');
	return { displayName, role: params.role };
}

// ─── Skill Generation ───────────────────────────────────────────────────────

function generateSkillForMember(member: ProposedMember, projectPath: string): string {
	// Core roles use built-in templates
	if (member.role === 'technical-pm') return TECHNICAL_PM_SKILL;
	if (member.role === 'scribe') return SCRIBE_SKILL;
	if (member.role === 'qa-tester' || member.role === 'qa-engineer') return QA_TESTER_SKILL;

	// Tester role (separate from QA)
	if (member.role === 'tester') {
		return generateTesterSkill();
	}

	// Specialist roles get generated skills
	return generateSpecialistSkill(member, projectPath);
}

function generateTesterSkill(): string {
	return `---
role: tester
tools:
  - read_file
  - edit_file
  - run_command
  - search_code
veto: false
---

# Tester

## Identity
You are the Tester — responsible for functional testing, integration testing, and CI/CD pipeline health.

## Responsibilities
- Write and maintain integration and end-to-end tests
- Verify feature implementations against acceptance criteria
- Run test suites and report failures with clear reproduction steps
- Monitor CI/CD pipeline health and investigate flaky tests
- Set up test infrastructure (fixtures, mocks, test databases)

## Boundaries
- You focus on test code and test infrastructure
- You do NOT write production features
- You work alongside the QA Engineer but focus on automation over manual review
- You ensure CI stays green before any merge

## Standards
- All new features must have integration tests
- Flaky tests must be identified and either fixed or quarantined
- Test runs must be reproducible and fast
- CI/CD pipeline failures are your top priority
`;
}

function generateSpecialistSkill(member: ProposedMember, projectPath: string): string {
	const summary = sampleCodebase(projectPath);
	const langContext = Object.keys(summary.manifests)
		.map((f) => {
			if (f.includes('package.json')) return 'TypeScript/JavaScript';
			if (f.includes('Cargo.toml')) return 'Rust';
			if (f.includes('go.mod')) return 'Go';
			if (f.includes('pyproject.toml') || f.includes('requirements.txt')) return 'Python';
			return null;
		})
		.filter(Boolean)
		.join(', ');

	return `---
role: ${member.role}
tools:
  - read_file
  - edit_file
  - run_command
  - search_code
veto: false
---

# ${member.title}

## Identity
You are a ${member.title} — a senior/principal-level specialist.
${member.justification ? `Hired because: ${member.justification}` : ''}

## Responsibilities
- Implement features and fix bugs within your area of expertise
- Write clean, well-tested code following project conventions
- Provide expert-level guidance on your specialty area during team discussions
- Run tests before submitting work for review
- Mentor other team members on best practices in your domain

## Boundaries
- Only work on tasks assigned to you by the Technical PM
- Do NOT modify files outside your area of expertise unless directed
- Do NOT merge PRs — submit work for Technical PM review
- Always run the test suite before reporting task completion

## Project Context
${langContext ? `Languages: ${langContext}` : ''}
`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function safeReadDir(dir: string): string[] {
	try {
		if (!existsSync(dir)) return [];
		return readdirSync(dir);
	} catch {
		return [];
	}
}

function safeReadFile(path: string, maxLength: number): string {
	try {
		if (!existsSync(path)) return '';
		const content = readFileSync(path, 'utf-8');
		return content.length > maxLength ? `${content.slice(0, maxLength)}\n...(truncated)` : content;
	} catch {
		return '';
	}
}

function buildDirectoryTree(rootPath: string, maxDepth: number, maxEntries: number): string {
	const lines: string[] = [];
	function walk(dir: string, prefix: string, depth: number) {
		if (depth > maxDepth || lines.length >= maxEntries) return;
		const entries = safeReadDir(dir).filter(
			(e) => !e.startsWith('.') && e !== 'node_modules' && e !== 'dist' && e !== 'target',
		);
		for (const entry of entries.slice(0, 20)) {
			if (lines.length >= maxEntries) {
				lines.push(`${prefix}... (truncated)`);
				return;
			}
			lines.push(`${prefix}${entry}`);
			const fullPath = join(dir, entry);
			try {
				const stat = statSync(fullPath);
				if (stat.isDirectory()) {
					walk(fullPath, `${prefix}  `, depth + 1);
				}
			} catch {
				// skip
			}
		}
	}
	walk(rootPath, '', 0);
	return lines.join('\n');
}

function extractJson(text: string): Record<string, unknown> | null {
	try {
		return JSON.parse(text.trim());
	} catch {
		const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		if (match) {
			try {
				return JSON.parse(match[1].trim());
			} catch {
				return null;
			}
		}
		const braceMatch = text.match(/\{[\s\S]*\}/);
		if (braceMatch) {
			try {
				return JSON.parse(braceMatch[0]);
			} catch {
				return null;
			}
		}
		return null;
	}
}

function fallbackAnalysis(projectPath: string): {
	specialists: { role: string; title: string; justification: string }[];
	separateQaAndTester: boolean;
} {
	const files = safeReadDir(projectPath);
	const specialists: { role: string; title: string; justification: string }[] = [];

	if (files.includes('package.json')) {
		const pkg = safeReadJson(join(projectPath, 'package.json'));
		if (pkg) {
			const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } as Record<
				string,
				string
			>;
			if (deps.react) {
				specialists.push({
					role: 'senior-react-engineer',
					title: 'Senior React Engineer',
					justification: 'Project uses React for frontend',
				});
			}
			if (deps.express || deps.fastify || deps.koa) {
				specialists.push({
					role: 'senior-node-backend-engineer',
					title: 'Senior Node.js Backend Engineer',
					justification: 'Project has Node.js backend',
				});
			}
		}
	}
	if (files.includes('Cargo.toml')) {
		specialists.push({
			role: 'senior-rust-engineer',
			title: 'Senior Rust Engineer',
			justification: 'Project uses Rust',
		});
	}
	if (files.includes('go.mod')) {
		specialists.push({
			role: 'senior-go-engineer',
			title: 'Senior Go Engineer',
			justification: 'Project uses Go',
		});
	}

	if (specialists.length === 0) {
		specialists.push({
			role: 'senior-software-engineer',
			title: 'Senior Software Engineer',
			justification: 'General development work',
		});
	}

	return { specialists, separateQaAndTester: false };
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
