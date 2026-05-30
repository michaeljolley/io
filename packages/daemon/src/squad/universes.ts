/**
 * Universe registry — maps pop-culture universes to character rosters.
 * Each character has an archetype that maps to technical roles.
 */

export interface UniverseCharacter {
	name: string;
	/** Broad archetype used to match against technical roles */
	archetype: 'leader' | 'builder' | 'tester' | 'writer' | 'specialist' | 'strategist';
}

export interface Universe {
	id: string;
	label: string;
	characters: UniverseCharacter[];
}

const UNIVERSES: Universe[] = [
	{
		id: 'a-team',
		label: 'The A-Team',
		characters: [
			{ name: 'Hannibal', archetype: 'leader' },
			{ name: 'Face', archetype: 'strategist' },
			{ name: 'Murdock', archetype: 'specialist' },
			{ name: 'B.A. Baracus', archetype: 'builder' },
			{ name: 'Frankie', archetype: 'writer' },
			{ name: 'Tawnia', archetype: 'tester' },
		],
	},
	{
		id: 'marvel',
		label: 'Marvel Avengers',
		characters: [
			{ name: 'Iron Man', archetype: 'leader' },
			{ name: 'Black Widow', archetype: 'strategist' },
			{ name: 'Spider-Man', archetype: 'builder' },
			{ name: 'Hulk', archetype: 'tester' },
			{ name: 'Vision', archetype: 'specialist' },
			{ name: 'Captain America', archetype: 'leader' },
			{ name: 'Thor', archetype: 'builder' },
			{ name: 'Hawkeye', archetype: 'specialist' },
			{ name: 'Scarlet Witch', archetype: 'specialist' },
			{ name: 'Jarvis', archetype: 'writer' },
		],
	},
	{
		id: 'star-wars',
		label: 'Star Wars',
		characters: [
			{ name: 'Obi-Wan', archetype: 'leader' },
			{ name: 'Luke', archetype: 'builder' },
			{ name: 'Leia', archetype: 'strategist' },
			{ name: 'Han Solo', archetype: 'specialist' },
			{ name: 'Chewbacca', archetype: 'builder' },
			{ name: 'R2-D2', archetype: 'tester' },
			{ name: 'C-3PO', archetype: 'writer' },
			{ name: 'Yoda', archetype: 'leader' },
			{ name: 'Ahsoka', archetype: 'specialist' },
			{ name: 'Mando', archetype: 'specialist' },
		],
	},
	{
		id: 'lord-of-the-rings',
		label: 'Lord of the Rings',
		characters: [
			{ name: 'Gandalf', archetype: 'leader' },
			{ name: 'Aragorn', archetype: 'strategist' },
			{ name: 'Legolas', archetype: 'specialist' },
			{ name: 'Gimli', archetype: 'builder' },
			{ name: 'Sam', archetype: 'tester' },
			{ name: 'Frodo', archetype: 'builder' },
			{ name: 'Elrond', archetype: 'writer' },
			{ name: 'Éowyn', archetype: 'specialist' },
		],
	},
	{
		id: 'star-trek',
		label: 'Star Trek',
		characters: [
			{ name: 'Picard', archetype: 'leader' },
			{ name: 'Data', archetype: 'specialist' },
			{ name: 'Geordi', archetype: 'builder' },
			{ name: 'Worf', archetype: 'tester' },
			{ name: 'Riker', archetype: 'strategist' },
			{ name: 'Troi', archetype: 'writer' },
			{ name: "O'Brien", archetype: 'builder' },
			{ name: 'Spock', archetype: 'specialist' },
			{ name: 'Scotty', archetype: 'builder' },
			{ name: 'Uhura', archetype: 'writer' },
		],
	},
	{
		id: 'firefly',
		label: 'Firefly',
		characters: [
			{ name: 'Mal', archetype: 'leader' },
			{ name: 'Wash', archetype: 'specialist' },
			{ name: 'Kaylee', archetype: 'builder' },
			{ name: 'Zoe', archetype: 'strategist' },
			{ name: 'Jayne', archetype: 'tester' },
			{ name: 'Inara', archetype: 'writer' },
			{ name: 'Simon', archetype: 'specialist' },
			{ name: 'River', archetype: 'specialist' },
		],
	},
];

/** Map technical roles to archetypes */
function roleToArchetype(role: string): UniverseCharacter['archetype'] {
	const r = role.toLowerCase();
	if (r.includes('lead') || r.includes('architect')) return 'leader';
	if (r.includes('test') || r.includes('qa')) return 'tester';
	if (r.includes('scribe') || r.includes('doc') || r.includes('writer')) return 'writer';
	if (r.includes('strateg') || r.includes('plan')) return 'strategist';
	// Most technical specialists (frontend, backend, devops, etc.) are builders
	return 'builder';
}

/** Get all available universe IDs */
export function listUniverses(): { id: string; label: string }[] {
	return UNIVERSES.map((u) => ({ id: u.id, label: u.label }));
}

/** Pick a random universe */
export function pickRandomUniverse(): Universe {
	return UNIVERSES[Math.floor(Math.random() * UNIVERSES.length)];
}

/** Get a universe by ID */
export function getUniverse(id: string): Universe | undefined {
	return UNIVERSES.find((u) => u.id === id);
}

/**
 * Assign character names to a list of roles from the given universe.
 * Tries to match archetype first; falls back to any unused character.
 * Returns a map of role → character name.
 */
export function assignCharacterNames(
	universeId: string,
	roles: string[],
): Map<string, string> {
	const universe = getUniverse(universeId) ?? pickRandomUniverse();
	const assignments = new Map<string, string>();
	const used = new Set<string>();

	for (const role of roles) {
		const archetype = roleToArchetype(role);

		// Try to find a matching archetype character that hasn't been used
		let match = universe.characters.find(
			(c) => c.archetype === archetype && !used.has(c.name),
		);

		// Fallback: any unused character
		if (!match) {
			match = universe.characters.find((c) => !used.has(c.name));
		}

		// Ultimate fallback: just use the role name if we run out
		const displayName = match?.name ?? role;
		assignments.set(role, displayName);
		if (match) used.add(match.name);
	}

	return assignments;
}
