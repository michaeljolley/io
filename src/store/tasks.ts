import { getDb } from "./db.js";

export interface AgentTask {
  task_id: string;
  agent_slug: string;
  description: string;
  status: string;
  result: string | null;
  origin_channel: string | null;
  instance_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export function createTask(
  taskId: string,
  agentSlug: string,
  description: string,
  originChannel?: string,
  instanceId?: string,
): AgentTask {
  const db = getDb();
  db.prepare(
    "INSERT INTO agent_tasks (task_id, agent_slug, description, origin_channel, instance_id) VALUES (?, ?, ?, ?, ?)",
  ).run(taskId, agentSlug, description, originChannel ?? null, instanceId ?? null);
  return getTask(taskId)!;
}

export function getTask(taskId: string): AgentTask | undefined {
  return getDb()
    .prepare("SELECT * FROM agent_tasks WHERE task_id = ?")
    .get(taskId) as AgentTask | undefined;
}

export function getActiveTasks(): AgentTask[] {
  return getDb()
    .prepare("SELECT * FROM agent_tasks WHERE status = 'running' ORDER BY started_at DESC")
    .all() as AgentTask[];
}

export function completeTask(taskId: string, result: string): void {
  getDb()
    .prepare(
      "UPDATE agent_tasks SET status = 'done', result = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ?",
    )
    .run(result, taskId);
}

export function failTask(taskId: string, error: string): void {
  getDb()
    .prepare(
      "UPDATE agent_tasks SET status = 'failed', result = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ?",
    )
    .run(error, taskId);
}

export function clearStaleTasks(): void {
  getDb()
    .prepare(
      "UPDATE agent_tasks SET status = 'failed', result = 'Marked stale on startup', completed_at = CURRENT_TIMESTAMP WHERE status = 'running'",
    )
    .run();
}

export function cancelTask(taskId: string, reason = "Cancelled by user"): void {
  getDb()
    .prepare(
      "UPDATE agent_tasks SET status = 'cancelled', result = ?, completed_at = CURRENT_TIMESTAMP WHERE task_id = ? AND status = 'running'",
    )
    .run(reason, taskId);
}

export function listRecentTasks(limit = 50): AgentTask[] {
  return getDb()
    .prepare(
      "SELECT * FROM agent_tasks ORDER BY datetime(started_at) DESC, task_id DESC LIMIT ?",
    )
    .all(limit) as AgentTask[];
}

export interface SquadWorkDistribution {
  total: number;
  perAgent: Array<{ agent_slug: string; count: number }>;
}

/**
 * Per-agent task count for the most recent `limit` tasks belonging to a
 * squad. Matches tasks routed to the squad itself (`agent_slug = squadSlug`)
 * AND tasks routed to a named agent on the squad (`agent_slug LIKE 'squadSlug:%'`).
 * Used by squad_status to surface fan-out imbalance.
 */
export function getSquadWorkDistribution(
  squadSlug: string,
  limit = 20,
): SquadWorkDistribution {
  const rows = getDb()
    .prepare(
      `SELECT agent_slug FROM agent_tasks
       WHERE agent_slug = ? OR agent_slug LIKE ?
       ORDER BY datetime(started_at) DESC, task_id DESC
       LIMIT ?`,
    )
    .all(squadSlug, `${squadSlug}:%`, limit) as Array<{ agent_slug: string }>;
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.agent_slug, (counts.get(row.agent_slug) ?? 0) + 1);
  }
  const perAgent = Array.from(counts.entries())
    .map(([agent_slug, count]) => ({ agent_slug, count }))
    .sort((a, b) => b.count - a.count);
  return { total: rows.length, perAgent };
}

export interface TaskReview {
  id: number;
  task_id: string;
  squad_slug: string;
  reviewer_character: string;
  approved: number;
  comments: string | null;
  created_at: string;
}

export function createReview(
  taskId: string,
  squadSlug: string,
  reviewerCharacter: string,
  approved: boolean,
  comments?: string,
): TaskReview {
  const db = getDb();
  const info = db
    .prepare(
      "INSERT INTO squad_task_reviews (task_id, squad_slug, reviewer_character, approved, comments) VALUES (?, ?, ?, ?, ?)",
    )
    .run(taskId, squadSlug, reviewerCharacter, approved ? 1 : 0, comments ?? null);
  return db
    .prepare("SELECT * FROM squad_task_reviews WHERE id = ?")
    .get(info.lastInsertRowid) as TaskReview;
}

export function getTaskReviews(taskId: string): TaskReview[] {
  return getDb()
    .prepare(
      "SELECT * FROM squad_task_reviews WHERE task_id = ? ORDER BY created_at ASC, id ASC",
    )
    .all(taskId) as TaskReview[];
}

export interface AgentTaskStats {
  character_name: string;       // bare squad-slug agents map to "" (legacy lead row)
  agent_slug: string;           // raw column value: "<squad>" or "<squad>:<char>"
  task_count: number;           // 0 if the agent has never been delegated to
  last_delegated_at: string | null; // ISO datetime string or null if never
}

/**
 * Per-character delegation stats for a squad.
 *
 * Returns one row PER CHARACTER NAME passed in `characterNames`, plus an
 * extra row with character_name="" for any tasks routed to the bare squad
 * slug (legacy lead tasks). Always returns a row for every requested
 * character, even if they have never been delegated to (task_count: 0,
 * last_delegated_at: null).
 *
 * Reads from the agent_stats view. Filters with `agent_slug = ?`
 * (for the bare slug) and `agent_slug = ?` for each `<slug>:<char>`.
 */
export function getAgentTaskStats(
  squadSlug: string,
  characterNames: string[],
): AgentTaskStats[] {
  // Build the full set of agent_slug values we care about
  const bareSlug = squadSlug;
  const namedSlugs = characterNames.map((c) => `${squadSlug}:${c}`);
  const allSlugs = [bareSlug, ...namedSlugs];

  const placeholders = allSlugs.map(() => "?").join(", ");
  interface StatRow { agent_slug: string; task_count: number; last_delegated_at: string | null }
  const rows = getDb()
    .prepare(
      `SELECT agent_slug, task_count, last_delegated_at FROM agent_stats WHERE agent_slug IN (${placeholders})`,
    )
    .all(...allSlugs) as StatRow[];

  const bySlug = new Map<string, StatRow>();
  for (const row of rows) bySlug.set(row.agent_slug, row);

  const results: AgentTaskStats[] = [];

  // Bare slug row (legacy lead tasks routed without a named agent)
  const bareRow = bySlug.get(bareSlug);
  results.push({
    character_name: "",
    agent_slug: bareSlug,
    task_count: bareRow?.task_count ?? 0,
    last_delegated_at: bareRow?.last_delegated_at ?? null,
  });

  // One row per requested character
  for (const char of characterNames) {
    const slug = `${squadSlug}:${char}`;
    const row = bySlug.get(slug);
    results.push({
      character_name: char,
      agent_slug: slug,
      task_count: row?.task_count ?? 0,
      last_delegated_at: row?.last_delegated_at ?? null,
    });
  }

  return results;
}

/**
 * Pick the stalest specialist in a squad. "Stalest" = the character who
 * has been delegated to least recently (oldest last_delegated_at), with
 * never-delegated agents considered staler than any delegated agent.
 *
 * Excludes character names listed in `excludeCharacters` (use this to
 * skip the lead). Returns null if the squad has no eligible agents OR if
 * all eligible agents have been delegated to within `freshIfWithinHours`
 * (default 48). The threshold is meant to suppress the hint when the
 * squad is already distributing well.
 *
 * On tie (e.g. two agents have never been delegated), returns the one
 * that sorts first by character_name (deterministic).
 */
export function getStalestSpecialist(
  squadSlug: string,
  characterNames: string[],
  options?: {
    excludeCharacters?: string[];
    freshIfWithinHours?: number;
  },
): { character_name: string; last_delegated_at: string | null; staleHours: number | null } | null {
  const exclude = new Set(options?.excludeCharacters ?? []);
  const freshThresholdHours = options?.freshIfWithinHours ?? 48;

  const stats = getAgentTaskStats(squadSlug, characterNames);

  // Filter: named agents only (skip the bare-slug "" row), skip excluded
  const eligible = stats.filter(
    (s) => s.character_name !== "" && !exclude.has(s.character_name),
  );

  if (eligible.length === 0) return null;

  const now = Date.now();

  // Sort: never-delegated (null) first, then ascending by last_delegated_at
  eligible.sort((a, b) => {
    if (a.last_delegated_at === null && b.last_delegated_at === null) {
      return a.character_name.localeCompare(b.character_name);
    }
    if (a.last_delegated_at === null) return -1;
    if (b.last_delegated_at === null) return 1;
    const tA = new Date(a.last_delegated_at + "Z").getTime();
    const tB = new Date(b.last_delegated_at + "Z").getTime();
    if (tA !== tB) return tA - tB;
    return a.character_name.localeCompare(b.character_name);
  });

  const stalest = eligible[0];
  let staleHours: number | null = null;

  if (stalest.last_delegated_at !== null) {
    const delegatedAt = new Date(stalest.last_delegated_at + "Z").getTime();
    staleHours = Math.round((now - delegatedAt) / 3_600_000);
    // Squad is distributing well — suppress the hint
    if (staleHours < freshThresholdHours) return null;
  }
  // null last_delegated_at means never-delegated: always considered stale

  return {
    character_name: stalest.character_name,
    last_delegated_at: stalest.last_delegated_at,
    staleHours,
  };
}
