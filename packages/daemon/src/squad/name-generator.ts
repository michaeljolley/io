import { getClient } from '../copilot/client.js';
import { createChildLogger } from '../logging/logger.js';

const logger = () => createChildLogger('name-generator');

export interface NameAssignment {
	role: string;
	displayName: string;
	persona: string;
}

export interface GeneratedNames {
	universe: string;
	assignments: NameAssignment[];
}

const NAME_GENERATION_PROMPT = `You are a creative naming assistant. Your job is to assign pop-culture character names to a team of AI agents based on their technical roles.

Rules:
- Each character name must be UNIQUE within the team
- Match character personalities to the technical role's nature (e.g. a methodical character for QA, a creative character for frontend)
- The persona should be 1-2 sentences describing how this character communicates — their tone, quirks, and style
- Keep personas fun but professional — they should enhance communication, not distract from technical work
- Return ONLY valid JSON, no markdown fencing

Respond with this exact JSON structure:
{
  "universe": "<the universe name>",
  "assignments": [
    { "role": "<technical role>", "displayName": "<character name>", "persona": "<1-2 sentence persona description>" }
  ]
}`;

/**
 * Generate character names and persona blurbs for squad members using the LLM.
 * If a universe is provided, names come from that universe.
 * If not, the LLM picks a fun universe on its own.
 */
export async function generateSquadNames(
	roles: string[],
	universe?: string,
): Promise<GeneratedNames> {
	const log = logger();

	const userPrompt = universe
		? `Assign character names from the "${universe}" universe to these team roles: ${roles.join(', ')}`
		: `Pick a fun pop-culture universe of your choice and assign character names to these team roles: ${roles.join(', ')}`;

	try {
		const client = await getClient();
		const session = await client.createSession({
			systemMessage: { mode: 'replace' as const, content: NAME_GENERATION_PROMPT },
		});

		let accumulated = '';
		const unsubDelta = session.on('assistant.message_delta', (event) => {
			accumulated += event.data.deltaContent;
		});

		try {
			await session.sendAndWait({ prompt: userPrompt }, 60_000);
		} finally {
			unsubDelta();
		}

		// Parse the JSON response
		const parsed = extractJson(accumulated);
		if (!parsed || !parsed.universe || !Array.isArray(parsed.assignments)) {
			throw new Error('Invalid response structure from LLM');
		}

		// Validate all roles are covered
		const result: GeneratedNames = {
			universe: parsed.universe as string,
			assignments: [],
		};

		for (const role of roles) {
			const match = (parsed.assignments as Record<string, string>[]).find(
				(a) => a.role?.toLowerCase() === role.toLowerCase(),
			);
			if (match) {
				result.assignments.push({
					role,
					displayName: match.displayName || match.display_name || role,
					persona: match.persona || '',
				});
			} else {
				// Role wasn't in LLM response — use role name as fallback
				result.assignments.push({ role, displayName: role, persona: '' });
			}
		}

		log.info({ universe: result.universe, count: result.assignments.length }, 'Names generated');
		return result;
	} catch (err) {
		log.error({ err, roles, universe }, 'Failed to generate names, falling back to role names');
		return fallback(roles);
	}
}

/** Fallback: use role names as display names with no persona */
function fallback(roles: string[]): GeneratedNames {
	return {
		universe: 'none',
		assignments: roles.map((role) => ({ role, displayName: role, persona: '' })),
	};
}

/** Extract JSON from LLM response (handles possible markdown fencing) */
function extractJson(text: string): Record<string, unknown> | null {
	try {
		return JSON.parse(text.trim());
	} catch {
		// Try extracting from markdown code fence
		const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
		if (match) {
			try {
				return JSON.parse(match[1].trim());
			} catch {
				return null;
			}
		}
		// Try finding JSON object in text
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
