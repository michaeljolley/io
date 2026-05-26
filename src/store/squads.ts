import { getDb } from "./db.js";
import { nextCharacter, randomUniverse, getUniverse, getOrCreateUniverse } from "../copilot/universes.js";
import type { Character, Universe } from "../copilot/universes.js";

// ---------------------------------------------------------------------------
// Squad color palette — universe-inspired distinct colors
// ---------------------------------------------------------------------------

export const SQUAD_COLOR_PALETTE: readonly string[] = [
  "#ff6b35", // A-Team orange
  "#ffd000", // Thundercats gold
  "#5fff87", // GI Joe green
  "#c4a7ff", // Ghostbusters purple
  "#00d9ff", // Transformers cyan
  "#ff9800", // extra amber
  "#9c27b0", // extra violet
  "#2196f3", // extra blue
  "#e91e63", // extra pink
  "#00bcd4", // extra teal
  "#8bc34a", // extra lime
  "#ff5722", // extra deep-orange
] as const;

/**
 * Pick a color for a new squad. Prefers an unused palette color; when all
 * are taken, cycles through the palette by position (modular assignment).
 * This guarantees we never throw and always return a valid hex color.
 */
export function pickSquadColor(existingColors: (string | null)[]): string {
  const used = new Set(existingColors.filter(Boolean) as string[]);
  const unused = SQUAD_COLOR_PALETTE.filter((c) => !used.has(c));
  if (unused.length > 0) return unused[0]!;
  // All palette colors taken — cycle by squad count
  return SQUAD_COLOR_PALETTE[used.size % SQUAD_COLOR_PALETTE.length]!;
}

export interface Squad {
  id: number;
  slug: string;
  name: string;
  project_path: string;
  copilot_session_id: string | null;
  model: string | null;
  universe: string | null;
  color: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SquadAgent {
  id: number;
  squad_slug: string;
  character_name: string;
  role_title: string;
  charter: string | null;
  model_tier: string;
  personality: string | null;
  copilot_session_id: string | null;
  status: string;
  is_lead: number;
  is_qa: number;
  created_at: string;
}

export interface SquadDecision {
  id: number;
  squad_slug: string;
  decision: string;
  context: string | null;
  created_at: string;
}

export function createSquad(
  slug: string,
  name: string,
  projectPath: string,
  universeId?: string,
): Squad {
  const db = getDb();
  const universe = universeId
    ? getOrCreateUniverse(universeId).id
    : randomUniverse().id;
  const existingSquads = listSquads();
  const color = pickSquadColor(existingSquads.map((s) => s.color));
  db.prepare(
    "INSERT INTO squads (slug, name, project_path, universe, color) VALUES (?, ?, ?, ?, ?)",
  ).run(slug, name, projectPath, universe, color);
  return getSquad(slug)!;
}

export function getSquad(slug: string): Squad | undefined {
  return getDb()
    .prepare("SELECT * FROM squads WHERE slug = ?")
    .get(slug) as Squad | undefined;
}

export function listSquads(): Squad[] {
  return getDb().prepare("SELECT * FROM squads ORDER BY created_at DESC").all() as Squad[];
}

export function updateSquadSession(slug: string, sessionId: string): void {
  getDb()
    .prepare(
      "UPDATE squads SET copilot_session_id = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?",
    )
    .run(sessionId, slug);
}

export function updateSquadStatus(slug: string, status: string): void {
  getDb()
    .prepare(
      "UPDATE squads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?",
    )
    .run(status, slug);
}

export function updateSquadModel(slug: string, model: string | null): void {
  getDb()
    .prepare(
      "UPDATE squads SET model = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?",
    )
    .run(model, slug);
}

export function deleteSquad(slug: string): void {
  const db = getDb();
  db.prepare("DELETE FROM squad_agents WHERE squad_slug = ?").run(slug);
  db.prepare("DELETE FROM squad_decisions WHERE squad_slug = ?").run(slug);
  db.prepare("DELETE FROM squads WHERE slug = ?").run(slug);
}

// ---------------------------------------------------------------------------
// Squad Agent CRUD
// ---------------------------------------------------------------------------

/**
 * Add a named agent to a squad. Automatically assigns the next character
 * from the squad's universe pool.
 */
export function addSquadAgent(
  squadSlug: string,
  roleTitle: string,
  charter: string,
  modelTier: string = "medium",
): SquadAgent {
  const squad = getSquad(squadSlug);
  if (!squad) throw new Error(`Squad not found: ${squadSlug}`);

  const universeId = squad.universe ?? randomUniverse().id;

  // If squad doesn't have a universe yet, set it
  if (!squad.universe) {
    getDb()
      .prepare("UPDATE squads SET universe = ? WHERE slug = ?")
      .run(universeId, squadSlug);
  }

  // Ensure universe is registered in runtime array (handles restart for custom universes)
  getOrCreateUniverse(universeId);

  const existingAgents = listSquadAgents(squadSlug);
  const usedNames = existingAgents.map((a) => a.character_name);
  const character = nextCharacter(universeId, usedNames);

  if (!character) {
    throw new Error(
      `All characters in the "${universeId}" universe are assigned. Remove an agent first.`,
    );
  }

  getDb()
    .prepare(
      `INSERT INTO squad_agents (squad_slug, character_name, role_title, charter, model_tier, personality)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      squadSlug,
      character.name,
      roleTitle,
      charter,
      modelTier,
      character.personality,
    );

  return getSquadAgent(squadSlug, character.name)!;
}

export function getSquadAgent(
  squadSlug: string,
  characterName: string,
): SquadAgent | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM squad_agents WHERE squad_slug = ? AND character_name = ?",
    )
    .get(squadSlug, characterName) as SquadAgent | undefined;
}

export function listSquadAgents(squadSlug: string): SquadAgent[] {
  return getDb()
    .prepare(
      "SELECT * FROM squad_agents WHERE squad_slug = ? ORDER BY id ASC",
    )
    .all(squadSlug) as SquadAgent[];
}

export function removeSquadAgent(
  squadSlug: string,
  characterName: string,
): boolean {
  const result = getDb()
    .prepare(
      "DELETE FROM squad_agents WHERE squad_slug = ? AND character_name = ?",
    )
    .run(squadSlug, characterName);
  return result.changes > 0;
}

export function updateAgentSession(
  squadSlug: string,
  characterName: string,
  sessionId: string,
): void {
  getDb()
    .prepare(
      "UPDATE squad_agents SET copilot_session_id = ? WHERE squad_slug = ? AND character_name = ?",
    )
    .run(sessionId, squadSlug, characterName);
}

export function updateAgentStatus(
  squadSlug: string,
  characterName: string,
  status: string,
): void {
  getDb()
    .prepare(
      "UPDATE squad_agents SET status = ? WHERE squad_slug = ? AND character_name = ?",
    )
    .run(status, squadSlug, characterName);
}

/**
 * Clear an agent's persisted copilot_session_id. Used during error recovery
 * so the next task creates a fresh session instead of trying to resume a
 * poisoned one.
 */
export function clearAgentSession(
  squadSlug: string,
  characterName: string,
): void {
  getDb()
    .prepare(
      "UPDATE squad_agents SET copilot_session_id = NULL WHERE squad_slug = ? AND character_name = ?",
    )
    .run(squadSlug, characterName);
}

/**
 * Reset any agent left in a non-idle status from a previous daemon run.
 * The in-memory Copilot sessions don't survive a restart, so persisted
 * "working" or "error" rows can never be accurate after startup. Returns
 * the number of rows reset for logging.
 */
export function reconcileAgentStatuses(): number {
  const info = getDb()
    .prepare(
      "UPDATE squad_agents SET status = 'idle' WHERE status IN ('working', 'error')",
    )
    .run();
  return info.changes;
}

/**
 * Mirror of reconcileAgentStatuses for squads themselves.
 */
export function reconcileSquadStatuses(): number {
  const info = getDb()
    .prepare(
      "UPDATE squads SET status = 'idle' WHERE status IN ('working', 'error')",
    )
    .run();
  return info.changes;
}

export function logDecision(
  squadSlug: string,
  decision: string,
  context?: string,
): void {
  getDb()
    .prepare(
      "INSERT INTO squad_decisions (squad_slug, decision, context) VALUES (?, ?, ?)",
    )
    .run(squadSlug, decision, context ?? null);
}

export function getDecisions(
  squadSlug: string,
  limit = 20,
): SquadDecision[] {
  return getDb()
    .prepare(
      "SELECT * FROM squad_decisions WHERE squad_slug = ? ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .all(squadSlug, limit) as SquadDecision[];
}

export function getDecisionsSummary(squadSlug: string): string {
  const decisions = getDecisions(squadSlug);
  if (decisions.length === 0) return "No decisions recorded.";

  return decisions
    .reverse()
    .map((d) => {
      const ctx = d.context ? ` (${d.context})` : "";
      return `- [${d.created_at}] ${d.decision}${ctx}`;
    })
    .join("\n");
}


export function setSquadLead(squadSlug: string, characterName: string): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE squad_agents SET is_lead = 0 WHERE squad_slug = ?",
    ).run(squadSlug);
    db.prepare(
      "UPDATE squad_agents SET is_lead = 1 WHERE squad_slug = ? AND character_name = ?",
    ).run(squadSlug, characterName);
  });
  tx();
}

export function getSquadLead(squadSlug: string): SquadAgent | undefined {
  return getDb()
    .prepare(
      "SELECT * FROM squad_agents WHERE squad_slug = ? AND is_lead = 1 LIMIT 1",
    )
    .get(squadSlug) as SquadAgent | undefined;
}


export function setSquadQA(squadSlug: string, characterName: string, isQA: boolean): void {
  getDb()
    .prepare(
      "UPDATE squad_agents SET is_qa = ? WHERE squad_slug = ? AND character_name = ?",
    )
    .run(isQA ? 1 : 0, squadSlug, characterName);
}
