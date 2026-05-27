import { randomUUID } from "node:crypto";
import { getDb } from "./db.js";

export interface Squad {
  id: string;
  name: string;
  universe: string;
  repo_url: string | null;
  rules: string;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  squad_id: string;
  character_name: string;
  role_title: string;
  persona: string;
  is_lead: number;
  is_qa: number;
  is_test: number;
  status: string;
  created_at: string;
}

export function createSquad(
  name: string,
  universe: string,
  repoUrl?: string
): Squad {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    "INSERT INTO squads (id, name, universe, repo_url) VALUES (?, ?, ?, ?)"
  ).run(id, name, universe, repoUrl ?? null);

  return db.prepare("SELECT * FROM squads WHERE id = ?").get(id) as Squad;
}

export function getSquad(id: string): Squad | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM squads WHERE id = ?").get(id) as Squad | undefined;
}

export function listSquads(): { squads: Squad[]; agents: Agent[] } {
  const db = getDb();
  const squads = db.prepare("SELECT * FROM squads ORDER BY created_at DESC").all() as Squad[];
  const agents = db.prepare("SELECT * FROM agents ORDER BY created_at").all() as Agent[];
  return { squads, agents };
}

export function deleteSquad(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM squads WHERE id = ?").run(id);
}

export function updateSquadRules(id: string, rules: string): void {
  const db = getDb();
  db.prepare("UPDATE squads SET rules = ?, updated_at = datetime('now') WHERE id = ?").run(
    rules,
    id
  );
}

export interface AddAgentInput {
  character_name: string;
  role_title: string;
  persona: string;
  is_lead: boolean;
  is_qa: boolean;
  is_test: boolean;
}

export function addAgent(squadId: string, input: AddAgentInput): Agent {
  const db = getDb();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO agents (id, squad_id, character_name, role_title, persona, is_lead, is_qa, is_test)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    squadId,
    input.character_name,
    input.role_title,
    input.persona,
    input.is_lead ? 1 : 0,
    input.is_qa ? 1 : 0,
    input.is_test ? 1 : 0
  );
  return db.prepare("SELECT * FROM agents WHERE id = ?").get(id) as Agent;
}

export function getAgentsForSquad(squadId: string): Agent[] {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE squad_id = ? ORDER BY created_at")
    .all(squadId) as Agent[];
}

export function getLeadForSquad(squadId: string): Agent | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM agents WHERE squad_id = ? AND is_lead = 1 LIMIT 1")
    .get(squadId) as Agent | undefined;
}

export function updateAgentStatus(agentId: string, status: string): void {
  const db = getDb();
  db.prepare("UPDATE agents SET status = ? WHERE id = ?").run(status, agentId);
}
