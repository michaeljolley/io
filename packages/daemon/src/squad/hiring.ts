import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { DEFAULT_MODEL, EVENT_NAMES, MANDATORY_ROLES, QA_MAX_REVISIONS } from "@io/shared";
import type { SquadConfig, SquadMember } from "@io/shared";

import { eventBus } from "../event-bus.js";
import {
	addMember,
	createSquad,
	getMembers,
	getSquad,
	getSquadByRepo,
	removeMember,
	updateSquad,
} from "../store/index.js";
import {
	QA_PROMPT,
	ROLE_GENERATION_PROMPT,
	TEAM_LEAD_PROMPT,
	generateRolePrompt,
} from "./roles.js";

export interface ProposedComposition {
	roles: Array<{
		role: string;
		name: string;
		description: string;
	}>;
}

interface ParsedCompositionResponse {
	roles?: ProposedComposition["roles"];
}

function parseRepoUrl(repoUrl: string): { owner: string; name: string } {
	const trimmed = repoUrl.trim();
	const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/([^/]+?)(?:\.git)?$/i);
	if (sshMatch) {
		return { owner: sshMatch[1], name: sshMatch[2] };
	}

	const normalized = trimmed.replace(/\.git$/i, "");
	const url = new URL(normalized);
	const segments = url.pathname.split("/").filter(Boolean);
	if (segments.length < 2) {
		throw new Error(`Unable to parse owner/name from repo URL: ${repoUrl}`);
	}

	return { owner: segments[0], name: segments[1] };
}

function slugifyRole(role: string): string {
	return role
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
	return value
		.split(/[-_\s]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function extractJsonObject(content: string): string | null {
	const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced?.[1]) {
		return fenced[1].trim();
	}

	const start = content.indexOf("{");
	const end = content.lastIndexOf("}");
	return start >= 0 && end > start ? content.slice(start, end + 1) : null;
}

function detectRolesFromAnalysis(repoAnalysis: string): ProposedComposition["roles"] {
	const analysis = repoAnalysis.toLowerCase();
	const roles: ProposedComposition["roles"] = [];

	if (/(react|next|vue|angular|frontend|ui|xaml)/.test(analysis)) {
		roles.push({
			role: "senior-frontend-engineer",
			name: "Senior Frontend Engineer",
			description: "Implements user-facing experiences, UI state, and presentation-layer changes.",
		});
	}

	if (/(node|express|api|backend|server|daemon|database|sql|postgres|sqlite)/.test(analysis)) {
		roles.push({
			role: "senior-backend-engineer",
			name: "Senior Backend Engineer",
			description:
				"Implements server-side logic, data access, integrations, and execution flow changes.",
		});
	}

	if (/(infra|docker|kubernetes|deploy|ci|cd|workflow|github actions)/.test(analysis)) {
		roles.push({
			role: "senior-platform-engineer",
			name: "Senior Platform Engineer",
			description: "Owns automation, pipelines, environments, and operational tooling.",
		});
	}

	if (/(security|auth|oauth|secret|policy)/.test(analysis)) {
		roles.push({
			role: "senior-security-engineer",
			name: "Senior Security Engineer",
			description:
				"Reviews authentication, authorization, secrets handling, and security-sensitive changes.",
		});
	}

	return roles;
}

function dedupeRoles(roles: ProposedComposition["roles"]): ProposedComposition["roles"] {
	const seen = new Set<string>();
	const output: ProposedComposition["roles"] = [];

	for (const role of roles) {
		const normalizedRole = slugifyRole(role.role);
		if (
			!normalizedRole ||
			seen.has(normalizedRole) ||
			MANDATORY_ROLES.includes(normalizedRole as (typeof MANDATORY_ROLES)[number])
		) {
			continue;
		}
		seen.add(normalizedRole);
		output.push({
			role: normalizedRole,
			name: role.name?.trim() || titleCase(normalizedRole),
			description: role.description?.trim() || `${titleCase(normalizedRole)} responsibilities`,
		});
	}

	return output;
}

function buildMandatoryRoles(): ProposedComposition["roles"] {
	return [
		{
			role: "team-lead",
			name: "Team Lead",
			description: "Coordinates planning, task assignment, sequencing, and final technical review.",
		},
		{
			role: "qa",
			name: "QA Reviewer",
			description: "Validates diffs, test evidence, and objective completion before delivery.",
		},
	];
}

function modelForRole(role: string): string {
	const normalized = slugifyRole(role);
	if (normalized === "team-lead") {
		return DEFAULT_MODEL;
	}

	return DEFAULT_MODEL;
}

function systemPromptForRole(role: string, repoContext: string): string {
	const normalized = slugifyRole(role);
	if (normalized === "team-lead") {
		return `${TEAM_LEAD_PROMPT}\n\nRepository context:\n${repoContext}`;
	}

	if (normalized === "qa") {
		return `${QA_PROMPT}\n\nRepository context:\n${repoContext}`;
	}

	return generateRolePrompt(normalized, repoContext);
}

export async function proposeSquadComposition(
	repoUrl: string,
	repoAnalysis: string,
	context?: string,
): Promise<ProposedComposition> {
	const mandatory = buildMandatoryRoles();
	const fallbackAdditional = dedupeRoles(detectRolesFromAnalysis(repoAnalysis));
	const contextSection = context ? `\n\nAdditional context from user:\n${context}` : "";
	const prompt = `Repository URL: ${repoUrl}\n\nRepository analysis:\n${repoAnalysis}${contextSection}\n\n${ROLE_GENERATION_PROMPT}`;

	let client: CopilotClient | null = null;
	try {
		client = new CopilotClient();
		await client.start();
		const session = await client.createSession({
			model: DEFAULT_MODEL,
			onPermissionRequest: approveAll,
			systemMessage: {
				content: ROLE_GENERATION_PROMPT,
			},
		});

		try {
			const response = await session.sendAndWait({ prompt }, 60_000);
			const content = response?.data.content?.trim() ?? "";
			const json = extractJsonObject(content);
			if (!json) {
				return { roles: [...mandatory, ...fallbackAdditional] };
			}

			const parsed = JSON.parse(json) as ParsedCompositionResponse;
			return {
				roles: [...mandatory, ...dedupeRoles(parsed.roles ?? fallbackAdditional)],
			};
		} finally {
			await session.disconnect().catch(() => undefined);
		}
	} catch {
		return { roles: [...mandatory, ...fallbackAdditional] };
	} finally {
		if (client) {
			await client.stop().catch(() => []);
		}
	}
}

export interface HireSquadResult {
	squad: NonNullable<Awaited<ReturnType<typeof getSquad>>>;
	members: SquadMember[];
}

export async function hireSquad(
	repoUrl: string,
	composition: ProposedComposition,
	config: SquadConfig,
): Promise<HireSquadResult> {
	const parsedRepo = parseRepoUrl(repoUrl);
	const repoContext = `Repository: ${parsedRepo.owner}/${parsedRepo.name}\nConfigured MCP servers: ${config.mcpServers.join(", ") || "none"}\nQA max revisions: ${config.maxRevisions || QA_MAX_REVISIONS}`;
	const existingSquad = await getSquadByRepo(parsedRepo.owner, parsedRepo.name);

	const normalizedConfig: SquadConfig = {
		prMode: config.prMode,
		mcpServers: [...config.mcpServers],
		maxRevisions: config.maxRevisions || QA_MAX_REVISIONS,
	};

	const desiredRoles = composition.roles.length > 0 ? composition.roles : buildMandatoryRoles();
	const membersToCreate = desiredRoles.map((role) => ({
		role: slugifyRole(role.role),
		name: role.name?.trim() || titleCase(role.role),
		description: role.description?.trim() || `${titleCase(role.role)} responsibilities`,
	}));

	let squadId: string;
	if (existingSquad) {
		const updatedSquad = await updateSquad(existingSquad.id, {
			name: `${titleCase(parsedRepo.name)} Squad`,
			config: normalizedConfig,
			status: existingSquad.status,
		});
		if (!updatedSquad) {
			throw new Error(`Unable to update existing squad for ${repoUrl}`);
		}
		squadId = updatedSquad.id;
		const existingMembers = await getMembers(updatedSquad.id);
		await Promise.all(existingMembers.map((member) => removeMember(member.id)));
	} else {
		const squad = await createSquad({
			name: `${titleCase(parsedRepo.name)} Squad`,
			repoUrl,
			repoOwner: parsedRepo.owner,
			repoName: parsedRepo.name,
			status: "active",
			config: normalizedConfig,
		});
		squadId = squad.id;
	}

	const members: SquadMember[] = [];
	for (const memberDefinition of membersToCreate) {
		const member = await addMember(squadId, {
			role: memberDefinition.role,
			name: memberDefinition.name,
			systemPrompt: systemPromptForRole(
				memberDefinition.role,
				`${repoContext}\nRole: ${memberDefinition.description}`,
			),
			model: modelForRole(memberDefinition.role),
		});
		members.push(member);
	}

	const fullSquad = await getSquad(squadId);
	if (!fullSquad) {
		throw new Error(`Unable to load squad ${squadId} after hiring`);
	}

	eventBus.emit(existingSquad ? EVENT_NAMES.SQUAD_UPDATED : EVENT_NAMES.SQUAD_CREATED, {
		squad: fullSquad,
	});

	return { squad: fullSquad, members: fullSquad.members };
}
