import { defineTool } from "@github/copilot-sdk";
import { z } from "zod";
import { execSync, execFileSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "fs";
import { join, dirname, resolve, sep } from "path";
import { homedir } from "os";
import { UNIVERSES, getOrCreateUniverse } from "./universes.js";
import { createFeedEntry } from "../store/feed.js";
import { validateCron, nextRun } from "./cron.js";
import {
  createIoSchedule,
  deleteIoSchedule,
  getIoSchedule,
  listIoSchedules,
  setIoScheduleEnabled,
  updateIoScheduleNextRun,
} from "../store/io-schedules.js";
import { runIoScheduleNow } from "./io-scheduler.js";
import {
  createSchedule,
  deleteSchedule,
  getSchedule,
  listSchedules,
  setScheduleEnabled,
} from "../store/schedules.js";
import { runScheduleNow } from "./scheduler.js";

// ---------------------------------------------------------------------------
// Squad coverage heuristics
//
// Every squad must have:
//   1. A dedicated team lead — a PM / Senior Engineer with no domain
//      responsibility — designated via squad_set_lead. The lead's job is
//      coordination, delegation, and review only. Lead veto power on PR
//      promotion is automatic (see runPeerReview in agents.ts).
//   2. At least one agent designated as QA (is_qa === 1) — see squad_set_qa.
//   3. At least one agent whose role title implies a testing/quality focus.
//
// These are surfaced as warnings on squad_status, squad_agents, and
// squad_delegate so users can fix coverage gaps before promoting work.
// ---------------------------------------------------------------------------

const TEST_ROLE_KEYWORDS = ["test", "qa", "quality", "tester", "sdet", "qe"];

// Words in a role title that imply the agent owns a hands-on engineering
// domain (and therefore should NOT be the team lead).
const DOMAIN_ROLE_KEYWORDS = [
  "frontend",
  "backend",
  "fullstack",
  "full-stack",
  "api",
  "ui",
  "ux",
  "test",
  "tester",
  "qa",
  "quality",
  "sdet",
  "qe",
  "devops",
  "sre",
  "ops",
  "infrastructure",
  "platform",
  "data",
  "database",
  "db",
  "ml",
  "ai",
  "sdk",
  "mobile",
  "ios",
  "android",
  "web",
  "security",
  "embedded",
  "integration",
  "telegram",
  "tui",
  "vue",
  "react",
  "angular",
  "express",
  "sqlite",
  "wiki",
];

// Words that mark a role as coordination/leadership-focused.
const LEAD_ROLE_KEYWORDS = [
  "lead",
  "manager",
  "pm",
  "principal",
  "coordinator",
  "director",
];

function containsWord(haystack: string, word: string): boolean {
  const re = new RegExp(`(^|[^a-z])${word}([^a-z]|$)`);
  return re.test(haystack);
}

export function roleLooksLikeTesting(roleTitle: string | null | undefined): boolean {
  if (!roleTitle) return false;
  const lower = roleTitle.toLowerCase();
  return TEST_ROLE_KEYWORDS.some((kw) => containsWord(lower, kw));
}

/**
 * A dedicated team lead has a role title that emphasises coordination/seniority
 * and does NOT also claim a hands-on engineering domain. Examples:
 *   ✅ "Engineering Lead", "Project Manager", "Senior Engineering Lead",
 *      "Principal Engineer", "Tech Lead", "Senior Engineer"
 *   ❌ "Frontend Lead", "Test Manager", "QA Lead", "Backend Engineer",
 *      "Express API Engineer"
 */
export function roleLooksLikeDedicatedLead(
  roleTitle: string | null | undefined,
): boolean {
  if (!roleTitle) return false;
  const lower = roleTitle.toLowerCase();
  const hasDomainKw = DOMAIN_ROLE_KEYWORDS.some((kw) => containsWord(lower, kw));
  if (hasDomainKw) return false;
  const hasLeadKw = LEAD_ROLE_KEYWORDS.some((kw) => containsWord(lower, kw));
  if (hasLeadKw) return true;
  // "Senior Engineer" / "Sr. Engineer" with no domain qualifier also counts.
  if (/(^|[^a-z])(senior|sr\.?)\s+engineer($|[^a-z])/.test(lower)) return true;
  return false;
}

export interface SquadCoverage {
  hasLead: boolean;
  hasDedicatedLead: boolean;
  hasQa: boolean;
  hasTestRole: boolean;
  missing: string[];
  warning: string | null;
}

export function assessSquadCoverage(
  agents: Array<{ role_title: string; is_qa?: number; is_lead?: number }>,
): SquadCoverage {
  const leadAgent = agents.find((a) => a.is_lead === 1);
  const hasLead = !!leadAgent;
  const hasDedicatedLead =
    !!leadAgent && roleLooksLikeDedicatedLead(leadAgent.role_title);
  const hasQa = agents.some((a) => a.is_qa === 1);
  const hasTestRole = agents.some((a) => roleLooksLikeTesting(a.role_title));
  const missing: string[] = [];
  if (!hasLead) {
    missing.push(
      "dedicated team lead (use squad_set_lead with a PM/Senior Engineer who owns no domain)",
    );
  } else if (!hasDedicatedLead) {
    missing.push(
      `dedicated lead role (current lead "${leadAgent!.role_title}" looks like a domain specialist — team leads must be PM/Senior Engineer with no domain ownership)`,
    );
  }
  if (!hasQa) missing.push("QA reviewer (use squad_set_qa)");
  if (!hasTestRole) {
    missing.push(
      "test/quality engineer (add an agent whose role_title contains 'test', 'qa', or 'quality')",
    );
  }
  const warning =
    missing.length > 0
      ? `⚠️ Squad coverage gap: missing ${missing.join("; ")}.`
      : null;
  return { hasLead, hasDedicatedLead, hasQa, hasTestRole, missing, warning };
}

// ---------------------------------------------------------------------------
// Work-distribution diagnostics
//
// Squads can fall into an anti-pattern (#51) where the team lead handles
// every delegated task instead of fanning out to specialists. We surface a
// soft warning on squad_status when the lead handles more than this share
// of recent tasks.
// ---------------------------------------------------------------------------

const WORK_DISTRIBUTION_WINDOW = 20;
const LEAD_OVERLOAD_THRESHOLD = 0.8;

interface WorkDistributionDeps {
  getSquadWorkDistribution: (
    squadSlug: string,
    limit?: number,
  ) => {
    total: number;
    perAgent: Array<{ agent_slug: string; count: number }>;
  };
}

function formatWorkDistribution(
  squadSlug: string,
  lead: { character_name: string; role_title: string } | undefined,
  deps: WorkDistributionDeps,
): string {
  const dist = deps.getSquadWorkDistribution(squadSlug, WORK_DISTRIBUTION_WINDOW);
  if (dist.total === 0) return "";

  const friendly = (agentSlug: string): string => {
    if (agentSlug === squadSlug) return "(unassigned)";
    const idx = agentSlug.indexOf(":");
    return idx >= 0 ? agentSlug.slice(idx + 1) : agentSlug;
  };

  const breakdown = dist.perAgent
    .map(
      (a) =>
        `${friendly(a.agent_slug)} ${a.count} (${Math.round(
          (a.count / dist.total) * 100,
        )}%)`,
    )
    .join(", ");

  const lines: string[] = [];
  lines.push(
    `\n  📊 Work distribution (last ${dist.total} task${dist.total === 1 ? "" : "s"}): ${breakdown}`,
  );

  if (lead) {
    const leadKey = `${squadSlug}:${lead.character_name}`;
    const leadCount =
      dist.perAgent.find((a) => a.agent_slug === leadKey)?.count ?? 0;
    const share = leadCount / dist.total;
    if (share > LEAD_OVERLOAD_THRESHOLD) {
      lines.push(
        `\n  ⚠️ Lead overload: ${lead.character_name} handled ${Math.round(share * 100)}% of recent tasks (threshold ${Math.round(LEAD_OVERLOAD_THRESHOLD * 100)}%). The lead should be delegating to specialists via delegate_to_teammate, not self-implementing — see issue #51.`,
      );
    }
  }

  return lines.join("");
}

// ---------------------------------------------------------------------------
// Per-agent delegation-stat formatters (issue #61)
// ---------------------------------------------------------------------------

/**
 * Format an ISO timestamp as a short relative time string. SQLite emits
 * naive UTC strings, so we suffix "Z" before parsing if it isn't already
 * timezone-qualified.
 */
function formatRelativeTime(iso: string | null): string {
  if (!iso) return "never";
  const tzQualified = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  const ts = new Date(tzQualified ? iso : iso + "Z").getTime();
  if (Number.isNaN(ts)) return "never";
  const deltaMs = Date.now() - ts;
  if (deltaMs < 60_000) return "just now";
  if (deltaMs < 3_600_000) {
    const m = Math.round(deltaMs / 60_000);
    return `${m}m ago`;
  }
  if (deltaMs < 86_400_000) {
    const h = Math.round(deltaMs / 3_600_000);
    return `${h}h ago`;
  }
  const d = Math.round(deltaMs / 86_400_000);
  return `${d}d ago`;
}

/**
 * Format a stale-hours number as a short duration. >=24h rounds to days,
 * smaller values stay in hours. Floors to keep behaviour consistent across
 * the squad_agents and squad_task_status renderers.
 */
function formatStaleDuration(staleHours: number): string {
  if (staleHours >= 24) {
    const d = Math.floor(staleHours / 24);
    return `${d}d`;
  }
  return `${Math.floor(staleHours)}h`;
}

/**
 * Build the ⚠️ stalest-specialist hint string from a getStalestSpecialist
 * result. Returns "" if the input is null (squad is healthy).
 */
function formatStalestHint(
  stalest: {
    character_name: string;
    last_delegated_at: string | null;
    staleHours: number | null;
  } | null,
): string {
  if (!stalest) return "";
  if (stalest.staleHours == null) {
    return `⚠️ ${stalest.character_name} has never been delegated to`;
  }
  return `⚠️ ${stalest.character_name} has not been delegated to in ${formatStaleDuration(stalest.staleHours)}`;
}

// Ensure child processes have HOME set (systemd services often don't)
function shellEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (!env.HOME) env.HOME = homedir();
  return env;
}

export interface ToolDeps {
  wikiRead: (path: string) => string | undefined;
  wikiWrite: (path: string, content: string) => void;
  wikiSearch: (query: string) => Array<{ path: string; title: string; snippet: string }>;
  wikiAssertPagePath: (path: string) => void;
  wikiDelete: (path: string) => boolean;
  wikiList: () => string[];
  getSquad: (slug: string) => { slug: string; name: string; projectPath: string; status: string; universe?: string | null } | undefined;
  listSquads: () => Array<{ slug: string; name: string; projectPath: string; status: string; universe?: string | null }>;
  createSquad: (slug: string, name: string, projectPath: string, universeId?: string) => void;
  deleteSquad: (slug: string) => void;
  logDecision: (squadSlug: string, decision: string, context?: string) => void;
  getDecisionsSummary: (squadSlug: string) => string;
  getRecentDecisions: (
    squadSlug: string,
    limit?: number,
  ) => Array<{ decision: string; context: string | null; created_at: string }>;
  updateSquadStatus: (slug: string, status: string) => void;
  delegateToAgent: (squadSlug: string, task: string, onComplete: (taskId: string, result: string) => void, targetAgent?: string) => Promise<string>;
  getTask: (taskId: string) => { task_id: string; agent_slug: string; description: string; status: string; result: string | null } | undefined;
  getActiveAgentTasks: () => Array<{ taskId: string; agentSlug: string; description: string; status: string }>;
  addSquadAgent: (squadSlug: string, roleTitle: string, charter: string, modelTier?: string) => { character_name: string; role_title: string; personality: string | null; model_tier: string };
  listSquadAgents: (squadSlug: string) => Array<{ character_name: string; role_title: string; charter: string | null; model_tier: string; personality: string | null; status: string; is_lead?: number; is_qa?: number }>;
  getAgentTaskStats: (squadSlug: string, characterNames: string[]) => Array<{
    character_name: string;
    agent_slug: string;
    task_count: number;
    last_delegated_at: string | null;
  }>;
  getStalestSpecialist: (
    squadSlug: string,
    characterNames: string[],
    options?: { excludeCharacters?: string[]; freshIfWithinHours?: number },
  ) => { character_name: string; last_delegated_at: string | null; staleHours: number | null } | null;
  removeSquadAgent: (squadSlug: string, characterName: string) => boolean;
  resetSquadAgent: (squadSlug: string, characterName: string) => { found: boolean; previousStatus: string; agent: { character_name: string; role_title: string } | null };
  setSquadLead: (squadSlug: string, characterName: string) => void;
  getSquadLead: (squadSlug: string) => { character_name: string; role_title: string } | undefined;
  setSquadQA: (squadSlug: string, characterName: string, isQA: boolean) => void;
  getTaskReviews: (taskId: string) => Array<{ reviewer_character: string; approved: number; comments: string | null; squad_slug: string }>;
  getSquadWorkDistribution: (squadSlug: string, limit?: number) => {
    total: number;
    perAgent: Array<{ agent_slug: string; count: number }>;
  };
  listSkills: () => Array<{ name: string; slug: string; description: string; path: string }>;
  installSkill: (repoUrl: string) => Promise<{ name: string; slug: string; description: string; path: string } | { name: string; slug: string; description: string; path: string }[]>;
  removeSkill: (slug: string) => boolean;
  searchSkillsRegistry: (query: string) => Promise<Array<{ name: string; description: string; repoUrl: string }>>;
  saveConfig: (updates: Record<string, unknown>) => void;
  checkForUpdate: () => Promise<{ updateAvailable: boolean; current: string; latest: string }>;
}


export function shouldRouteToInbox(taskDescription: string): boolean {
  const lower = taskDescription.toLowerCase();
  return (
    lower.includes("io inbox") ||
    lower.includes("io-inbox") ||
    lower.includes("send to inbox") ||
    lower.includes("to the inbox") ||
    lower.includes("result: \"io-inbox\"") ||
    lower.includes("not github or telegram") ||
    lower.includes("not telegram")
  );
}
export function createTools(deps: ToolDeps) {
  const wikiRead = defineTool("wiki_read", {
    description: "Read a page from IO's knowledge base wiki. Path is relative to the wiki root (e.g., 'pages/preferences/editor.md').",
    skipPermission: true,
    parameters: z.object({
      path: z.string().describe("Relative path to the wiki page"),
    }),
    handler: async ({ path }) => {
      const content = deps.wikiRead(path);
      if (!content) return `Page not found: ${path}`;
      return content;
    },
  });

  const wikiWrite = defineTool("wiki_write", {
    description: "Write or update a page in IO's knowledge base. Use this to remember preferences, project details, and important facts. Path must be under pages/ and end in .md.",
    skipPermission: true,
    parameters: z.object({
      path: z.string().describe("Relative path under pages/ (e.g., 'pages/preferences/clone-location.md')"),
      content: z.string().describe("Markdown content to write"),
    }),
    handler: async ({ path, content }) => {
      try {
        deps.wikiAssertPagePath(path);
        deps.wikiWrite(path, content);
        return `Written: ${path}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const wikiSearch = defineTool("wiki_search", {
    description: "Search IO's knowledge base for matching pages.",
    skipPermission: true,
    parameters: z.object({
      query: z.string().describe("Search query"),
    }),
    handler: async ({ query }) => {
      const results = deps.wikiSearch(query);
      if (results.length === 0) return "No matching pages found.";
      return results
        .map((r) => `**${r.title}** (${r.path})\n${r.snippet}`)
        .join("\n\n");
    },
  });

  const squadCreate = defineTool("squad_create", {
    description: "Create a persistent project squad with an 80s-themed team. A random universe (A-Team, Transformers, etc.) is assigned unless you specify one. After creating, use squad_analyze to examine the project, then squad_add_agent for each specialist needed.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Unique identifier (e.g., 'michaeljolley-io')"),
      name: z.string().describe("Display name (e.g., 'IO Assistant')"),
      project_path: z.string().describe("Path to the project directory"),
      universe: z
        .string()
        .optional()
        .describe("Universe theme for agent characters. Built-in: a-team, transformers, thundercats, gi-joe, aliens, ghostbusters, tmnt, star-wars, star-trek, lord-of-the-rings, the-office, parks-and-rec. Or provide any custom name. Random if omitted."),
    }),
    handler: async ({ slug, name, project_path, universe }) => {
      try {
        deps.createSquad(slug, name, project_path, universe);
        const squad = deps.getSquad(slug);
        const universeName = squad?.universe ? getOrCreateUniverse(squad.universe).name : "random";
        return `Squad "${name}" created for ${project_path}\nUniverse: ${universeName}\n\nNext steps:\n1. Use \`squad_analyze\` to examine the project\n2. Use \`squad_add_agent\` to add specialists based on the analysis`;
      } catch (err) {
        return `Error creating squad: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadRecall = defineTool("squad_recall", {
    description: "Recall a squad's context and past decisions. Use this before working on a project to load relevant history.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
    }),
    handler: async ({ slug }) => {
      const squad = deps.getSquad(slug);
      if (!squad) return `Squad not found: ${slug}`;
      const decisions = deps.getDecisionsSummary(slug);
      return `**Squad: ${squad.name}**\nProject: ${squad.projectPath}\nStatus: ${squad.status}\n\n${decisions}`;
    },
  });

  const squadStatus = defineTool("squad_status", {
    description: "List all squads with their universe theme and agent roster.",
    skipPermission: true,
    parameters: z.object({}),
    handler: async () => {
      const squads = deps.listSquads();
      if (squads.length === 0) return "No squads created yet.";
      return squads
        .map((s) => {
          const universeName = s.universe
            ? UNIVERSES.find((u) => u.id === s.universe)?.name ?? s.universe
            : "none";
          const agents = deps.listSquadAgents(s.slug);
          const lead = deps.getSquadLead(s.slug);
          const leadLine = lead
            ? `\n  ⭐ Team Lead: ${lead.character_name} (${lead.role_title})`
            : "";
          const agentList = agents.length > 0
            ? "\n  Agents: " + agents.map((a) => `${a.character_name} (${a.role_title})`).join(", ")
            : "\n  Agents: none — use squad_add_agent to build the team";
          const coverage = assessSquadCoverage(agents);
          const coverageLine = coverage.warning ? `\n  ${coverage.warning}` : "";
          const distLine = formatWorkDistribution(s.slug, lead, deps);
          const recentDecisions = deps.getRecentDecisions(s.slug, 3);
          const decisionsLine = recentDecisions.length === 0
            ? "\n  📜 Recent decisions: _none recorded — squad is not capturing institutional knowledge_"
            : "\n  📜 Recent decisions: " +
              recentDecisions
                .map((d) => `\"${d.decision.length > 80 ? d.decision.slice(0, 80) + "…" : d.decision}\"`)
                .join("; ");
          return `- **${s.name}** (\`${s.slug}\`) — ${s.status} — 🎬 ${universeName}${leadLine}${agentList}${coverageLine}${distLine}${decisionsLine}\n  📁 ${s.projectPath}`;
        })
        .join("\n");
    },
  });

  const squadLogDecision = defineTool("squad_log_decision", {
    description: "Log a decision for a squad. Use this to record important choices made during project work.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      decision: z.string().describe("The decision made"),
      context: z.string().optional().describe("Context or reasoning"),
    }),
    handler: async ({ slug, decision, context }) => {
      try {
        deps.logDecision(slug, decision, context);
        return `Decision logged for squad ${slug}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadDelegate = defineTool("squad_delegate", {
    description:
      "Delegate a task to a squad agent for autonomous execution. If the squad has named agents, you can target a specific one by character name, or let the system pick the best available agent. Returns a task ID immediately.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug to delegate to"),
      task: z
        .string()
        .describe(
          "Detailed task description. Be specific — include file paths, expected behavior, acceptance criteria. The agent works autonomously with this as its only instruction.",
        ),
      agent: z
        .string()
        .optional()
        .describe("Character name of a specific agent to target (e.g., 'Hannibal', 'Optimus Prime'). If omitted, the system picks the best available agent."),
    }),
    handler: async ({ slug, task, agent }) => {
      console.error(`[io] squad_delegate called: ${slug}${agent ? ` → ${agent}` : ""} — ${task.slice(0, 100)}…`);
      const roster = deps.listSquadAgents(slug);
      const coverage = assessSquadCoverage(roster);
      try {
        const taskId = await deps.delegateToAgent(slug, task, (id, result) => {
          console.error(`[io] Agent task ${id} completed for squad ${slug}`);
          if (shouldRouteToInbox(task)) {
            createFeedEntry({ type: "deliverable", title: `[${slug}] Task result`, body: result });
            console.error(`[io] Task ${id} result routed to inbox`);
          }
        }, agent);
        const agentLabel = agent ? `agent "${agent}" in squad "${slug}"` : `squad "${slug}"`;
        const warningPrefix = coverage.warning
          ? `${coverage.warning} A dedicated lead and a QA reviewer should both hold veto power on PR promotion — fix gaps before promoting work.\n\n`
          : "";
        return `${warningPrefix}Task delegated to ${agentLabel}. Task ID: ${taskId}\n\nThe agent is working on this in the background. Use squad_task_status to check progress.`;
      } catch (err) {
        return `Error delegating task: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadTaskStatus = defineTool("squad_task_status", {
    description:
      "Check the status of a delegated squad task, or list all active tasks. Returns status (running/done/failed) and result when complete.",
    skipPermission: true,
    parameters: z.object({
      task_id: z
        .string()
        .optional()
        .describe("Specific task ID to check. If omitted, lists all active tasks."),
    }),
    handler: async ({ task_id }) => {
      if (task_id) {
        const task = deps.getTask(task_id);
        if (!task) return `Task not found: ${task_id}`;
        let response = `**Task ${task.task_id}**\nSquad: ${task.agent_slug}\nStatus: ${task.status}\nDescription: ${task.description}`;
        if (task.result) {
          const result = task.result.length > 4000 ? task.result.slice(0, 4000) + "\n[…truncated]" : task.result;
          response += `\n\nResult:\n${result}`;
        }
        // Stalest-specialist hint for the squad this task belongs to (#61).
        try {
          const squadSlug = task.agent_slug.split(":")[0];
          if (squadSlug) {
            const roster = deps.listSquadAgents(squadSlug);
            const characterNames = roster.map((a) => a.character_name);
            const lead = roster.find((a) => a.is_lead === 1);
            const stalest = deps.getStalestSpecialist(squadSlug, characterNames, {
              excludeCharacters: lead ? [lead.character_name] : [],
            });
            const hint = formatStalestHint(stalest);
            if (hint) response += `\n\n${hint}`;
          }
        } catch (err) {
          console.error("[io] squad_task_status: stalest-specialist hint failed:", err);
        }
        return response;
      }
      const tasks = deps.getActiveAgentTasks();
      if (tasks.length === 0) return "No active tasks.";
      const taskLines = tasks
        .map((t) => `- **${t.taskId}** (${t.agentSlug}) — ${t.status} — ${t.description}`)
        .join("\n");

      // Per-squad stalest-specialist hint block (#61).
      let hintsBlock = "";
      try {
        const uniqueSquadSlugs = Array.from(
          new Set(tasks.map((t) => t.agentSlug.split(":")[0]).filter((x): x is string => !!x)),
        );
        const hintLines: string[] = [];
        for (const squadSlug of uniqueSquadSlugs) {
          const roster = deps.listSquadAgents(squadSlug);
          if (roster.length === 0) continue;
          const characterNames = roster.map((a) => a.character_name);
          const lead = roster.find((a) => a.is_lead === 1);
          const stalest = deps.getStalestSpecialist(squadSlug, characterNames, {
            excludeCharacters: lead ? [lead.character_name] : [],
          });
          const hint = formatStalestHint(stalest);
          if (hint) hintLines.push(`- ${squadSlug}: ${hint}`);
        }
        if (hintLines.length > 0) {
          hintsBlock = `\n\n**Distribution hints:**\n${hintLines.join("\n")}`;
        }
      } catch (err) {
        console.error("[io] squad_task_status: distribution hints failed:", err);
      }

      return `${taskLines}${hintsBlock}`;
    },
  });

  // --- Squad analyze ---
  const squadAnalyze = defineTool("squad_analyze", {
    description:
      "Analyze a project directory to determine what specialist agents the squad needs. Scans for languages, frameworks, test tools, CI/CD config, and project structure. Use the output to decide which agents to add with squad_add_agent.",
    skipPermission: true,
    parameters: z.object({
      project_path: z.string().describe("Path to the project directory to analyze"),
    }),
    handler: async ({ project_path }) => {
      console.error(`[io] squad_analyze called: ${project_path}`);
      try {
        const resolved = resolve(project_path);
        if (!existsSync(resolved)) return `Directory not found: ${project_path}`;

        const analysis: string[] = [];
        analysis.push(`## Project Analysis: ${project_path}\n`);

        // Detect languages & frameworks by scanning for key files
        const indicators: Array<{ file: string; label: string }> = [
          { file: "package.json", label: "Node.js/JavaScript/TypeScript" },
          { file: "tsconfig.json", label: "TypeScript" },
          { file: "Cargo.toml", label: "Rust" },
          { file: "go.mod", label: "Go" },
          { file: "requirements.txt", label: "Python" },
          { file: "pyproject.toml", label: "Python" },
          { file: "Gemfile", label: "Ruby" },
          { file: "pom.xml", label: "Java (Maven)" },
          { file: "build.gradle", label: "Java/Kotlin (Gradle)" },
          { file: "*.csproj", label: ".NET/C#" },
          { file: "*.fsproj", label: ".NET/F#" },
          { file: "*.sln", label: ".NET Solution" },
          { file: "Dockerfile", label: "Docker" },
          { file: "docker-compose.yml", label: "Docker Compose" },
          { file: "docker-compose.yaml", label: "Docker Compose" },
          { file: ".github/workflows", label: "GitHub Actions CI/CD" },
          { file: ".gitlab-ci.yml", label: "GitLab CI" },
          { file: "Jenkinsfile", label: "Jenkins CI" },
          { file: "azure-pipelines.yml", label: "Azure Pipelines" },
          { file: "vite.config.ts", label: "Vite" },
          { file: "vite.config.js", label: "Vite" },
          { file: "next.config.js", label: "Next.js" },
          { file: "next.config.mjs", label: "Next.js" },
          { file: "nuxt.config.ts", label: "Nuxt" },
          { file: "angular.json", label: "Angular" },
          { file: "tailwind.config.js", label: "Tailwind CSS" },
          { file: "tailwind.config.ts", label: "Tailwind CSS" },
          { file: "jest.config.js", label: "Jest testing" },
          { file: "jest.config.ts", label: "Jest testing" },
          { file: "vitest.config.ts", label: "Vitest testing" },
          { file: ".eslintrc.js", label: "ESLint" },
          { file: "eslint.config.js", label: "ESLint" },
          { file: "terraform", label: "Terraform" },
          { file: "serverless.yml", label: "Serverless Framework" },
        ];

        const detected: string[] = [];
        for (const { file, label } of indicators) {
          if (file.includes("*")) {
            // Glob-like check — just look for files ending with the pattern
            const ext = file.replace("*", "");
            try {
              const entries = readdirSync(resolved);
              if (entries.some((e) => e.endsWith(ext))) {
                detected.push(label);
              }
            } catch { /* skip */ }
          } else {
            if (existsSync(join(resolved, file))) {
              detected.push(label);
            }
          }
        }

        if (detected.length > 0) {
          analysis.push(`**Detected Technologies**: ${[...new Set(detected)].join(", ")}`);
        }

        // Read package.json for more detail
        const pkgPath = join(resolved, "package.json");
        if (existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
            const frameworks: string[] = [];
            const depNames = Object.keys(allDeps);

            const frameworkMap: Record<string, string> = {
              react: "React", vue: "Vue.js", angular: "Angular", svelte: "Svelte",
              express: "Express.js", fastify: "Fastify", koa: "Koa", hono: "Hono",
              "next": "Next.js", "nuxt": "Nuxt", "@nestjs/core": "NestJS",
              prisma: "Prisma ORM", drizzle: "Drizzle ORM", sequelize: "Sequelize",
              mongoose: "Mongoose", typeorm: "TypeORM",
              jest: "Jest", vitest: "Vitest", mocha: "Mocha", playwright: "Playwright",
              cypress: "Cypress", "@testing-library/react": "React Testing Library",
              tailwindcss: "Tailwind CSS", "@mui/material": "MUI",
              electron: "Electron", tauri: "Tauri",
              "@github/copilot-sdk": "GitHub Copilot SDK",
            };

            for (const [dep, label] of Object.entries(frameworkMap)) {
              if (depNames.includes(dep)) frameworks.push(label);
            }

            if (frameworks.length > 0) {
              analysis.push(`**Frameworks/Libraries**: ${frameworks.join(", ")}`);
            }
            if (pkg.scripts) {
              analysis.push(`**Scripts**: ${Object.keys(pkg.scripts).join(", ")}`);
            }
          } catch { /* skip */ }
        }

        // Detect directory structure (top-level)
        try {
          const entries = readdirSync(resolved);
          const dirs = entries.filter((e) => {
            try { return statSync(join(resolved, e)).isDirectory() && !e.startsWith("."); }
            catch { return false; }
          });
          if (dirs.length > 0) {
            analysis.push(`**Top-level directories**: ${dirs.join(", ")}`);
          }
        } catch { /* skip */ }

        analysis.push(
          "\n**Recommendation**: Based on this analysis, use `squad_add_agent` to create specialists. " +
          "Choose role titles that match the project's technology stack (e.g., 'Express API Engineer', " +
          "'Vue.js Frontend Developer', 'Vitest Test Engineer'). Write a charter for each agent describing " +
          "their specific responsibilities within this project.",
        );

        return analysis.join("\n");
      } catch (err) {
        return `Error analyzing project: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // --- Squad add agent ---
  const squadAddAgent = defineTool("squad_add_agent", {
    description:
      "Add a named specialist agent to a squad. The next character from the squad's 80s universe is automatically assigned. Use after squad_analyze to build the team.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      role_title: z
        .string()
        .describe(
          "Free-form role title based on project needs (e.g., 'Express API Engineer', 'Vue.js Frontend Dev', 'Vitest Test Engineer', 'GitHub Actions CI/CD Specialist')",
        ),
      charter: z
        .string()
        .describe(
          "Detailed description of this agent's responsibilities, technologies they own, and quality standards. This becomes their persistent mission.",
        ),
      model_tier: z
        .enum(["high", "medium", "low"])
        .optional()
        .describe("Model tier for this agent. Defaults to 'medium'. Use 'high' for architecture/complex work, 'low' for simple tasks."),
    }),
    handler: async ({ slug, role_title, charter, model_tier }) => {
      console.error(`[io] squad_add_agent called: ${slug} — ${role_title}`);
      try {
        const agent = deps.addSquadAgent(slug, role_title, charter, model_tier);
        return `Agent added to squad "${slug}":\n- **${agent.character_name}** — ${agent.role_title}\n- Personality: ${agent.personality}\n- Model tier: ${agent.model_tier}`;
      } catch (err) {
        return `Error adding agent: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // --- Squad agents (list roster) ---
  const squadAgents = defineTool("squad_agents", {
    description: "List all named agents in a squad's roster with their character names, roles, and status.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
    }),
    handler: async ({ slug }) => {
      const squad = deps.getSquad(slug);
      if (!squad) return `Squad not found: ${slug}`;

      const agents = deps.listSquadAgents(slug);
      if (agents.length === 0) {
        return `Squad "${squad.name}" has no agents yet. Use squad_add_agent to build the team.`;
      }

      const universeName = squad.universe
        ? UNIVERSES.find((u) => u.id === squad.universe)?.name ?? squad.universe
        : "none";

      // Pull per-agent task stats once and key by character_name (issue #61).
      // If the helper throws (e.g. brand-new DB before view migration), fall
      // back to an empty map so rendering is unchanged rather than 500-ing.
      const characterNames = agents.map((a) => a.character_name);
      const statsByName = new Map<string, { task_count: number; last_delegated_at: string | null }>();
      try {
        for (const st of deps.getAgentTaskStats(slug, characterNames)) {
          statsByName.set(st.character_name, {
            task_count: st.task_count,
            last_delegated_at: st.last_delegated_at,
          });
        }
      } catch (err) {
        console.error("[io] squad_agents: getAgentTaskStats failed:", err);
      }

      const lines = agents.map((a) => {
        const leadBadge = a.is_lead === 1 ? " ⭐ [LEAD]" : "";
        const qaBadge = a.is_qa === 1 ? " 🛡️ [QA]" : "";
        const st = statsByName.get(a.character_name) ?? { task_count: 0, last_delegated_at: null };
        const statsStr = st.task_count === 0
          ? " — 📊 never delegated"
          : ` — 📊 ${st.task_count} ${st.task_count === 1 ? "task" : "tasks"} · last ${formatRelativeTime(st.last_delegated_at)}`;
        return `- **${a.character_name}**${leadBadge}${qaBadge} — ${a.role_title} (${a.model_tier}) — ${a.status}${statsStr}${a.personality ? `\n  _${a.personality}_` : ""}`;
      });

      const coverage = assessSquadCoverage(agents);
      const coverageBlock = coverage.warning ? `\n\n${coverage.warning}` : "";

      // Stalest-specialist hint (issue #61): exclude the lead so the hint
      // points at an under-utilised teammate rather than the coordinator.
      let stalestBlock = "";
      try {
        const lead = agents.find((a) => a.is_lead === 1);
        const stalest = deps.getStalestSpecialist(slug, characterNames, {
          excludeCharacters: lead ? [lead.character_name] : [],
        });
        const hint = formatStalestHint(stalest);
        if (hint) stalestBlock = `\n\n${hint}`;
      } catch (err) {
        console.error("[io] squad_agents: getStalestSpecialist failed:", err);
      }

      return `**${squad.name}** — 🎬 ${universeName}\n\n${lines.join("\n")}${coverageBlock}${stalestBlock}`;
    },
  });

  // --- Squad remove agent ---
  const squadRemoveAgent = defineTool("squad_remove_agent", {
    description: "Remove a named agent from a squad's roster.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      character_name: z.string().describe("Character name of the agent to remove"),
    }),
    handler: async ({ slug, character_name }) => {
      console.error(`[io] squad_remove_agent called: ${slug} — ${character_name}`);
      const removed = deps.removeSquadAgent(slug, character_name);
      return removed
        ? `Agent "${character_name}" removed from squad "${slug}".`
        : `Agent "${character_name}" not found in squad "${slug}".`;
    },
  });

  const squadResetAgent = defineTool("squad_reset_agent", {
    description:
      "Clear a squad agent's error state and return them to idle without removing them. Preserves their charter, role title, character name, and is_lead/is_qa flags. Drops the agent's in-memory and persisted Copilot session so the next task starts fresh. Safe to call on a non-error agent (no-op with a clear message).",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      character_name: z.string().describe("Character name of the agent to reset"),
    }),
    handler: async ({ slug, character_name }) => {
      console.error(`[io] squad_reset_agent called: ${slug} — ${character_name}`);
      const squad = deps.getSquad(slug);
      if (!squad) return `Squad not found: ${slug}`;
      const result = deps.resetSquadAgent(slug, character_name);
      if (!result.found || !result.agent) {
        return `Agent "${character_name}" not found in squad "${slug}".`;
      }
      const { previousStatus, agent } = result;
      if (previousStatus === "error") {
        return `🔄 ${agent.character_name} (${agent.role_title}) reset from 'error' → 'idle'. Charter and role preserved; next task will create a fresh Copilot session.`;
      }
      if (previousStatus === "idle") {
        return `${agent.character_name} (${agent.role_title}) is already 'idle'. No-op: in-memory session cache and persisted session id were cleared anyway so the next task starts fresh.`;
      }
      // working / unknown
      return `⚠️ ${agent.character_name} (${agent.role_title}) was in '${previousStatus}' (not 'error'). Forced to 'idle' and cleared session anyway — verify no task is actually still running for this agent (call squad_task_status).`;
    },
  });

  // --- Squad delete ---
  const squadDelete = defineTool("squad_delete", {
    description: "Delete a squad and all its agents and decisions. This is permanent.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug to delete"),
    }),
    handler: async ({ slug }) => {
      console.error(`[io] squad_delete called: ${slug}`);
      try {
        const squad = deps.getSquad(slug);
        if (!squad) return `Squad not found: ${slug}`;
        deps.deleteSquad(slug);
        return `Squad "${squad.name}" (${slug}) has been deleted.`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // --- Skill management ---
  const skillList = defineTool("skill_list", {
    description: "List all installed skills with their names, slugs, and descriptions.",
    skipPermission: true,
    parameters: z.object({}),
    handler: async () => {
      const skills = deps.listSkills();
      if (skills.length === 0) return "No skills installed.";
      return skills
        .map((s) => `- **${s.name}** (\`${s.slug}\`): ${s.description || "(no description)"}`)
        .join("\n");
    },
  });

  const skillInstall = defineTool("skill_install", {
    description: "Install a skill from a git repository URL or a direct SKILL.md file URL. Accepts full repo URLs (clones the repo) and GitHub blob/raw URLs pointing to a specific SKILL.md (fetches just that file).",
    skipPermission: true,
    parameters: z.object({
      repo_url: z.string().describe("Git repository URL (e.g., https://github.com/user/my-skill.git) or direct SKILL.md URL (e.g., https://github.com/user/repo/blob/main/skills/my-skill/SKILL.md)"),
    }),
    handler: async ({ repo_url }) => {
      console.error(`[io] skill_install called: ${repo_url}`);
      try {
        const result = await deps.installSkill(repo_url);
        const skills = Array.isArray(result) ? result : [result];
        return skills.map((skill) =>
          `Skill "${skill.name}" installed successfully.\nSlug: ${skill.slug}\nDescription: ${skill.description || "(none)"}`,
        ).join("\n\n");
      } catch (err) {
        return `Error installing skill: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const skillRemove = defineTool("skill_remove", {
    description: "Remove an installed skill by its slug.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Skill slug to remove"),
    }),
    handler: async ({ slug }) => {
      console.error(`[io] skill_remove called: ${slug}`);
      const removed = deps.removeSkill(slug);
      return removed ? `Skill "${slug}" removed.` : `Skill not found: ${slug}`;
    },
  });

  const skillSearch = defineTool("skill_search", {
    description: "Search the skills.sh registry for skills matching a query.",
    skipPermission: true,
    parameters: z.object({
      query: z.string().describe("Search query"),
    }),
    handler: async ({ query }) => {
      console.error(`[io] skill_search called: ${query}`);
      try {
        const results = await deps.searchSkillsRegistry(query);
        if (results.length === 0) return `No skills found for "${query}".`;
        return results
          .map((r) => `- **${r.name}**: ${r.description}\n  ${r.repoUrl}`)
          .join("\n");
      } catch (err) {
        return `Error searching registry: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // --- Wiki extras ---
  const wikiDelete = defineTool("wiki_delete", {
    description: "Delete a page from IO's knowledge base wiki.",
    skipPermission: true,
    parameters: z.object({
      path: z.string().describe("Relative path to the wiki page (e.g., 'pages/preferences/editor.md')"),
    }),
    handler: async ({ path: pagePath }) => {
      console.error(`[io] wiki_delete called: ${pagePath}`);
      try {
        const deleted = deps.wikiDelete(pagePath);
        return deleted ? `Deleted: ${pagePath}` : `Page not found: ${pagePath}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const wikiList = defineTool("wiki_list", {
    description: "List all pages in IO's knowledge base wiki.",
    skipPermission: true,
    parameters: z.object({}),
    handler: async () => {
      const pages = deps.wikiList();
      if (pages.length === 0) return "Wiki is empty — no pages yet.";
      return pages.map((p) => `- ${p}`).join("\n");
    },
  });

  // --- Config update ---
  const configUpdate = defineTool("config_update", {
    description: "Update IO's configuration. Changes are saved to ~/.io/config.json and take effect on restart.",
    skipPermission: true,
    parameters: z.object({
      key: z
        .enum(["defaultModel", "telegramEnabled", "selfEditEnabled", "port", "authorizedEmail"])
        .describe("Config key to update"),
      value: z
        .union([z.string(), z.number(), z.boolean()])
        .describe("New value for the config key"),
    }),
    handler: async ({ key, value }) => {
      console.error(`[io] config_update called: ${key} = ${JSON.stringify(value)}`);
      try {
        deps.saveConfig({ [key]: value });
        return `Config updated: ${key} = ${JSON.stringify(value)}\nNote: Some changes require a restart to take effect.`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // --- Update checker ---
  const checkUpdate = defineTool("check_update", {
    description: "Check if a newer version of IO is available.",
    skipPermission: true,
    parameters: z.object({}),
    handler: async () => {
      try {
        const info = await deps.checkForUpdate();
        if (info.updateAvailable) {
          return `Update available! Current: v${info.current} → Latest: v${info.latest}\nRun: npm update -g heyio`;
        }
        return `IO is up to date (v${info.current}).`;
      } catch (err) {
        return `Error checking for updates: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const shell = defineTool("shell", {
    description: "Run a shell command on the host machine. You have FULL ROOT ACCESS. Use for git, apt, npm, build tools, system administration, or anything else. There are NO permission restrictions — all commands are allowed and pre-approved.",
    skipPermission: true,
    parameters: z.object({
      command: z.string().describe("The command to run"),
      timeout_secs: z.number().optional().describe("Timeout in seconds (default: 60)"),
      working_dir: z.string().optional().describe("Working directory for the command"),
    }),
    handler: async ({ command, timeout_secs, working_dir }) => {
      console.error(`[io] shell tool called: ${command}${working_dir ? ` (cwd: ${working_dir})` : ""}`);
      try {
        const result = execSync(command, {
          encoding: "utf-8",
          timeout: (timeout_secs ?? 60) * 1000,
          maxBuffer: 1024 * 1024,
          cwd: working_dir,
          env: shellEnv(),
        });
        const output = result.trim();
        if (output.length > 8000) {
          return output.slice(0, 8000) + "\n\n[…truncated]";
        }
        return output || "(no output)";
      } catch (err: unknown) {
        const execErr = err as { stderr?: string; stdout?: string; message?: string };
        const stderr = execErr.stderr?.trim() ?? "";
        const stdout = execErr.stdout?.trim() ?? "";
        const msg = stderr || stdout || execErr.message || "Command failed";
        if (msg.length > 4000) {
          return `Error:\n${msg.slice(0, 4000)}\n[…truncated]`;
        }
        return `Error:\n${msg}`;
      }
    },
  });

  const fileOps = defineTool("file_ops", {
    description: "Read, write, list, or mkdir on the local filesystem. Full access to all paths.",
    skipPermission: true,
    parameters: z.object({
      operation: z.enum(["read", "write", "list", "mkdir"]).describe("Operation to perform"),
      path: z.string().describe("File or directory path"),
      content: z.string().optional().describe("Content to write (for write operation)"),
      recursive: z.boolean().optional().describe("Recurse into subdirectories (for list)"),
    }),
    handler: async ({ operation, path: filePath, content, recursive }) => {
      console.error(`[io] file_ops tool called: ${operation} ${filePath}`);
      try {
        const resolved = resolve(filePath);

        if (operation === "read") {
          if (!existsSync(resolved)) return `File not found: ${filePath}`;
          const text = readFileSync(resolved, "utf-8");
          if (text.length > 8000) {
            return text.slice(0, 8000) + "\n\n[…truncated]";
          }
          return text;
        }

        if (operation === "write") {
          if (!content) return "Error: content is required for write operation";
          mkdirSync(dirname(resolved), { recursive: true });
          writeFileSync(resolved, content, "utf-8");
          return `Written: ${filePath}`;
        }

        if (operation === "list") {
          if (!existsSync(resolved)) return `Directory not found: ${filePath}`;
          if (recursive) {
            const files = walkDirectory(resolved);
            return files.join("\n") || "(empty directory)";
          }
          const entries = readdirSync(resolved);
          return entries
            .map((e) => {
              const full = join(resolved, e);
              const isDir = statSync(full).isDirectory();
              return isDir ? `${e}/` : e;
            })
            .join("\n") || "(empty directory)";
        }

        if (operation === "mkdir") {
          mkdirSync(resolved, { recursive: true });
          return `Created directory: ${filePath}`;
        }

        return `Unknown operation: ${operation}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // Override built-in bash tool so the model uses our implementation
  const bash = defineTool("bash", {
    description: "Run a bash command on the host machine with full root access.",
    skipPermission: true,
    overridesBuiltInTool: true,
    parameters: z.object({
      command: z.string().describe("The command to run"),
    }),
    handler: async ({ command }) => {
      console.error(`[io] bash tool called: ${command}`);
      try {
        const result = execSync(command, {
          encoding: "utf-8",
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
          env: shellEnv(),
        });
        const output = result.trim();
        if (output.length > 8000) {
          return output.slice(0, 8000) + "\n\n[…truncated]";
        }
        return output || "(no output)";
      } catch (err: unknown) {
        const execErr = err as { stderr?: string; stdout?: string; message?: string };
        const stderr = execErr.stderr?.trim() ?? "";
        const stdout = execErr.stdout?.trim() ?? "";
        const msg = stderr || stdout || execErr.message || "Command failed";
        if (msg.length > 4000) {
          return `Error:\n${msg.slice(0, 4000)}\n[…truncated]`;
        }
        return `Error:\n${msg}`;
      }
    },
  });

  // Override built-in read_file tool
  const readFile = defineTool("read_file", {
    description: "Read a file from the filesystem.",
    skipPermission: true,
    overridesBuiltInTool: true,
    parameters: z.object({
      file_path: z.string().describe("Path to the file to read"),
    }),
    handler: async ({ file_path }) => {
      console.error(`[io] read_file tool called: ${file_path}`);
      try {
        const resolved = resolve(file_path);
        if (!existsSync(resolved)) return `File not found: ${file_path}`;
        const text = readFileSync(resolved, "utf-8");
        if (text.length > 8000) {
          return text.slice(0, 8000) + "\n\n[…truncated]";
        }
        return text;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // Override built-in view tool
  const viewTool = defineTool("view", {
    description: "View a file's contents or list a directory.",
    skipPermission: true,
    overridesBuiltInTool: true,
    parameters: z.object({
      path: z.string().describe("Path to the file or directory"),
      view_range: z.array(z.number()).optional().describe("Line range [start, end] to view"),
    }),
    handler: async ({ path: filePath, view_range }) => {
      console.error(`[io] view tool called: ${filePath}`);
      try {
        const resolved = resolve(filePath);
        if (!existsSync(resolved)) return `Not found: ${filePath}`;
        const stat = statSync(resolved);
        if (stat.isDirectory()) {
          const entries = readdirSync(resolved);
          return entries
            .map((e) => {
              const full = join(resolved, e);
              try {
                return statSync(full).isDirectory() ? `${e}/` : e;
              } catch { return e; }
            })
            .join("\n") || "(empty directory)";
        }
        const text = readFileSync(resolved, "utf-8");
        if (view_range && view_range.length === 2) {
          const lines = text.split("\n");
          const start = Math.max(0, view_range[0] - 1);
          const end = view_range[1] === -1 ? lines.length : Math.min(lines.length, view_range[1]);
          return lines.slice(start, end).map((l, i) => `${start + i + 1}. ${l}`).join("\n");
        }
        if (text.length > 8000) {
          return text.slice(0, 8000) + "\n\n[…truncated]";
        }
        return text;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // Override built-in grep tool
  const grepTool = defineTool("grep", {
    description: "Search file contents using a pattern.",
    skipPermission: true,
    overridesBuiltInTool: true,
    parameters: z.object({
      pattern: z.string().describe("Search pattern (regex)"),
      path: z.string().optional().describe("Directory or file to search"),
      include: z.string().optional().describe("Glob pattern to filter files (e.g., '*.ts')"),
    }),
    handler: async ({ pattern, path: searchPath, include }) => {
      console.error(`[io] grep tool called: ${pattern} in ${searchPath || "."}`);
      try {
        const args = ["-rn", pattern];
        if (include) args.push(`--include=${include}`);
        args.push(searchPath || ".");
        const result = execFileSync("grep", args, {
          encoding: "utf-8",
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
          env: shellEnv(),
        });
        const output = result.trim();
        if (output.length > 8000) {
          return output.slice(0, 8000) + "\n\n[…truncated]";
        }
        return output || "(no matches)";
      } catch (err: unknown) {
        const execErr = err as { status?: number; stdout?: string };
        if (execErr.status === 1) return "(no matches)";
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // Override built-in str_replace_editor tool
  const strReplaceEditor = defineTool("str_replace_editor", {
    description: "View, create, or edit files using string replacement.",
    skipPermission: true,
    overridesBuiltInTool: true,
    parameters: z.object({
      command: z.enum(["view", "create", "str_replace", "insert"]).describe("Command to execute"),
      path: z.string().describe("File path"),
      old_str: z.string().optional().describe("String to replace (for str_replace)"),
      new_str: z.string().optional().describe("Replacement string"),
      file_text: z.string().optional().describe("Content for create"),
      insert_line: z.number().optional().describe("Line number for insert"),
      view_range: z.array(z.number()).optional().describe("Line range [start, end]"),
    }),
    handler: async ({ command, path: filePath, old_str, new_str, file_text, insert_line, view_range }) => {
      console.error(`[io] str_replace_editor tool called: ${command} ${filePath}`);
      try {
        const resolved = resolve(filePath);
        if (command === "view") {
          if (!existsSync(resolved)) return `File not found: ${filePath}`;
          const text = readFileSync(resolved, "utf-8");
          if (view_range && view_range.length === 2) {
            const lines = text.split("\n");
            const start = Math.max(0, view_range[0] - 1);
            const end = view_range[1] === -1 ? lines.length : Math.min(lines.length, view_range[1]);
            return lines.slice(start, end).map((l, i) => `${start + i + 1}. ${l}`).join("\n");
          }
          if (text.length > 8000) return text.slice(0, 8000) + "\n\n[…truncated]";
          return text;
        }
        if (command === "create") {
          mkdirSync(dirname(resolved), { recursive: true });
          writeFileSync(resolved, file_text || "", "utf-8");
          return `Created: ${filePath}`;
        }
        if (command === "str_replace") {
          if (!existsSync(resolved)) return `File not found: ${filePath}`;
          const text = readFileSync(resolved, "utf-8");
          if (old_str && !text.includes(old_str)) return `old_str not found in ${filePath}`;
          const updated = old_str ? text.replace(old_str, new_str || "") : text;
          writeFileSync(resolved, updated, "utf-8");
          return `Updated: ${filePath}`;
        }
        if (command === "insert") {
          if (!existsSync(resolved)) return `File not found: ${filePath}`;
          const lines = readFileSync(resolved, "utf-8").split("\n");
          const lineNum = insert_line ?? lines.length;
          lines.splice(lineNum, 0, new_str || "");
          writeFileSync(resolved, lines.join("\n"), "utf-8");
          return `Inserted at line ${lineNum} in ${filePath}`;
        }
        return `Unknown command: ${command}`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  // GitHub issue/PR management via gh CLI
  const github = defineTool("github", {
    description:
      "Manage GitHub issues and pull requests using the gh CLI. Supports creating, listing, viewing, commenting on, and reviewing issues and PRs.",
    skipPermission: true,
    parameters: z.object({
      action: z
        .enum([
          "create_issue",
          "list_issues",
          "view_issue",
          "comment_issue",
          "close_issue",
          "create_pr",
          "list_prs",
          "view_pr",
          "comment_pr",
          "review_pr",
        ])
        .describe("The GitHub action to perform"),
      repo: z.string().describe("Repository in owner/repo format"),
      title: z.string().optional().describe("Title (for create_issue, create_pr)"),
      body: z.string().optional().describe("Body text (for create_issue, create_pr, comment_*)"),
      labels: z.array(z.string()).optional().describe("Labels (for create_issue)"),
      assignees: z.array(z.string()).optional().describe("Assignees (for create_issue)"),
      number: z.number().optional().describe("Issue or PR number (for view, comment, close)"),
      base: z.string().optional().describe("Base branch (for create_pr)"),
      head: z.string().optional().describe("Head branch (for create_pr)"),
      state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state (for list_*)"),
      limit: z.number().optional().describe("Max results (for list_*, default 10)"),
      review_action: z.enum(["approve", "request-changes", "comment"]).optional()
        .describe("Review action (for review_pr): approve, request-changes, or comment"),
    }),
    handler: async ({ action, repo, title, body, labels, assignees, number, base, head, state, limit, review_action }) => {
      console.error(`[io] github tool called: ${action} on ${repo}`);
      try {
        let args: string[];

        switch (action) {
          case "create_issue": {
            if (!title) return "Error: title is required for create_issue";
            args = ["issue", "create", "--repo", repo, "--title", title];
            if (body) args.push("--body", body);
            if (labels?.length) args.push("--label", labels.join(","));
            if (assignees?.length) args.push("--assignee", assignees.join(","));
            break;
          }
          case "list_issues": {
            args = ["issue", "list", "--repo", repo, "--limit", String(limit ?? 10)];
            if (state) args.push("--state", state);
            break;
          }
          case "view_issue": {
            if (!number) return "Error: number is required for view_issue";
            args = ["issue", "view", String(number), "--repo", repo];
            break;
          }
          case "comment_issue": {
            if (!number) return "Error: number is required for comment_issue";
            if (!body) return "Error: body is required for comment_issue";
            args = ["issue", "comment", String(number), "--repo", repo, "--body", body];
            break;
          }
          case "close_issue": {
            if (!number) return "Error: number is required for close_issue";
            args = ["issue", "close", String(number), "--repo", repo];
            break;
          }
          case "create_pr": {
            if (!title) return "Error: title is required for create_pr";
            args = ["pr", "create", "--repo", repo, "--title", title];
            if (body) args.push("--body", body);
            if (base) args.push("--base", base);
            if (head) args.push("--head", head);
            break;
          }
          case "list_prs": {
            args = ["pr", "list", "--repo", repo, "--limit", String(limit ?? 10)];
            if (state) args.push("--state", state);
            break;
          }
          case "view_pr": {
            if (!number) return "Error: number is required for view_pr";
            args = ["pr", "view", String(number), "--repo", repo];
            break;
          }
          case "comment_pr": {
            if (!number) return "Error: number is required for comment_pr";
            if (!body) return "Error: body is required for comment_pr";
            args = ["pr", "comment", String(number), "--repo", repo, "--body", body];
            break;
          }
          case "review_pr": {
            if (!number) return "Error: number is required for review_pr";
            if (!review_action) return "Error: review_action is required for review_pr (approve, request-changes, or comment)";
            args = ["pr", "review", String(number), "--repo", repo, `--${review_action}`];
            if (body && (review_action === "request-changes" || review_action === "comment")) {
              args.push("--body", body);
            }
            break;
          }
          default:
            return `Unknown action: ${action}`;
        }

        const result = execFileSync("gh", args, {
          encoding: "utf-8",
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
          env: shellEnv(),
        }).trim();
        if (result.length > 8000) {
          return result.slice(0, 8000) + "\n\n[…truncated]";
        }
        return result || "(success, no output)";
      } catch (err: unknown) {
        const execErr = err as { stderr?: string; stdout?: string; message?: string };
        const msg = execErr.stderr?.trim() || execErr.stdout?.trim() || execErr.message || "Command failed";
        return `Error: ${msg.length > 4000 ? msg.slice(0, 4000) + "\n[…truncated]" : msg}`;
      }
    },
  });

  const squadSetQA = defineTool("squad_set_qa", {
    description:
      "Mark a squad agent as a QA reviewer with veto power. QA agents must approve before a PR is promoted from draft to ready.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      character_name: z.string().describe("Character name of the agent"),
      is_qa: z
        .boolean()
        .describe("Whether this agent is a QA reviewer (true) or not (false)"),
    }),
    handler: async ({ slug, character_name, is_qa }) => {
      try {
        const squad = deps.getSquad(slug);
        if (!squad) return `Squad not found: ${slug}`;
        const agents = deps.listSquadAgents(slug);
        const target = agents.find((a) => a.character_name === character_name);
        if (!target) {
          return `Agent "${character_name}" not found in squad "${slug}".`;
        }
        deps.setSquadQA(slug, character_name, is_qa);
        return is_qa
          ? `🛡️ ${character_name} (${target.role_title}) is now a QA reviewer for squad "${squad.name}". They have veto power over PR promotion.`
          : `${character_name} is no longer a QA reviewer for squad "${squad.name}".`;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadTaskReviews = defineTool("squad_task_reviews", {
    description:
      "Get the peer reviews left on a completed task by the squad. Shows who approved or rejected and any comments.",
    skipPermission: true,
    parameters: z.object({
      task_id: z.string().describe("The task ID to fetch reviews for"),
    }),
    handler: async ({ task_id }) => {
      const reviews = deps.getTaskReviews(task_id);
      if (reviews.length === 0) {
        return `No reviews found for task ${task_id}.`;
      }
      // Look up reviewer roles (lead/qa) so we can flag where each verdict
      // came from. Lead and QA reviewers both have veto power.
      const rolesBySquad = new Map<
        string,
        Map<string, { is_lead: boolean; is_qa: boolean }>
      >();
      const rolesFor = (squadSlug: string, character: string) => {
        let squadMap = rolesBySquad.get(squadSlug);
        if (!squadMap) {
          squadMap = new Map();
          for (const a of deps.listSquadAgents(squadSlug)) {
            squadMap.set(a.character_name, {
              is_lead: a.is_lead === 1,
              is_qa: a.is_qa === 1,
            });
          }
          rolesBySquad.set(squadSlug, squadMap);
        }
        return squadMap.get(character) ?? { is_lead: false, is_qa: false };
      };
      return reviews
        .map((r) => {
          const { is_lead, is_qa } = rolesFor(r.squad_slug, r.reviewer_character);
          const approved = r.approved === 1;
          let badge = "";
          if (is_lead && is_qa) badge = "⭐🛡️ ";
          else if (is_lead) badge = "⭐ ";
          else if (is_qa) badge = "🛡️ ";
          const verdict = approved
            ? `${badge}✅ APPROVED`
            : `${badge}❌ REJECTED`;
          const tags: string[] = [];
          if (is_lead) tags.push("lead");
          if (is_qa) tags.push("QA");
          const tagSuffix = tags.length ? ` _(${tags.join(", ")})_` : "";
          const veto = !approved && (is_lead || is_qa) ? " — **veto**" : "";
          const comments = r.comments ? `\n  ${r.comments.replace(/\n/g, "\n  ")}` : "";
          return `- **${r.reviewer_character}**${tagSuffix} — ${verdict}${veto}${comments}`;
        })
        .join("\n");
    },
  });

  const squadSetLead = defineTool("squad_set_lead", {
    description:
      "Designate an agent as the team lead for their squad. The lead MUST be a dedicated PM / Senior Engineer with NO domain responsibility — their sole job is coordinating, delegating, and reviewing the team's work. Do not pick an agent who also owns the backend, frontend, tests, or any other implementation domain. The lead receives delegated tasks (when no specific agent is targeted), orchestrates the team via delegate_to_teammate, and holds automatic veto power on PR promotion.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug"),
      character_name: z
        .string()
        .describe(
          "Character name of the agent to make team lead. Choose a PM / Senior Engineer with no domain ownership.",
        ),
    }),
    handler: async ({ slug, character_name }) => {
      try {
        const squad = deps.getSquad(slug);
        if (!squad) return `Squad not found: ${slug}`;
        const agents = deps.listSquadAgents(slug);
        const target = agents.find((a) => a.character_name === character_name);
        if (!target) {
          return `Agent "${character_name}" not found in squad "${slug}". Use squad_agents to list the roster.`;
        }
        deps.setSquadLead(slug, character_name);
        const dedicated = roleLooksLikeDedicatedLead(target.role_title);
        const base = `⭐ ${character_name} (${target.role_title}) is now the team lead for squad "${squad.name}". They have automatic veto power on PR promotion.`;
        if (!dedicated) {
          return `${base}\n\n⚠️ "${target.role_title}" looks like a domain specialist. Team leads should be a dedicated PM / Senior Engineer with no other domain responsibility — consider adding a dedicated lead agent (e.g. role "Senior Engineering Lead" or "Project Manager") and reassigning.`;
        }
        return base;
      } catch (err) {
        return `Error: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });


  // ---------------------------------------------------------------------------
  // Squad schedules — recurring stand-ups via cron-style expressions.
  // ---------------------------------------------------------------------------

  const KNOWN_AGENDA_ITEMS = ["triage", "prioritize", "ideation"] as const;

  const squadScheduleCreate = defineTool("squad_schedule_create", {
    description:
      "Schedule a recurring stand-up for a squad. The squad wakes on the cron schedule, the team lead runs the agenda, and teammates are pulled in via delegate_to_teammate. Built-in agenda items: triage (process needs-triage issues), prioritize (pick highest-priority ready work and start it), ideation (brainstorm + open needs-review issues). Custom agenda items are passed through to the lead verbatim.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().describe("Squad slug to schedule"),
      name: z
        .string()
        .describe("Human-friendly name for this schedule, e.g. 'Daily 5AM stand-up'"),
      cron: z
        .string()
        .describe(
          "Standard 5-field cron expression: 'minute hour dom month dow'. Examples: '0 5 * * *' = daily at 5:00, '0 9 * * 1-5' = 9AM weekdays, '*/15 * * * *' = every 15 minutes.",
        ),
      agenda: z
        .array(z.string())
        .min(1)
        .describe(
          `Ordered agenda. Built-in items: ${KNOWN_AGENDA_ITEMS.join(", ")}. You may include custom items; the team lead will improvise.`,
        ),
      notes: z
        .string()
        .optional()
        .describe("Optional operator notes appended to the stand-up prompt."),
    }),
    handler: async ({ slug, name, cron, agenda, notes }) => {
      const squad = deps.getSquad(slug);
      if (!squad) return `Squad not found: ${slug}`;
      const v = validateCron(cron);
      if (!v.ok) return `Invalid cron expression: ${v.error}`;
      const created = createSchedule({
        squadSlug: slug,
        name,
        cronExpr: cron,
        agenda,
        notes: notes ?? null,
        nextRunAt: v.next.toISOString(),
      });
      return `📅 Scheduled "${created.name}" for squad "${squad.name}" (id ${created.id}).\n- Cron: \`${cron}\`\n- Agenda: ${agenda.join(", ")}\n- Next run: ${v.next.toISOString()}`;
    },
  });

  const squadScheduleList = defineTool("squad_schedule_list", {
    description:
      "List squad stand-up schedules. Pass a slug to filter to one squad, or omit to list all.",
    skipPermission: true,
    parameters: z.object({
      slug: z.string().optional().describe("Optional squad slug to filter"),
    }),
    handler: async ({ slug }) => {
      const schedules = listSchedules(slug);
      if (schedules.length === 0) {
        return slug
          ? `No schedules for squad "${slug}".`
          : "No squad schedules configured.";
      }
      return schedules
        .map((s) => {
          const enabled = s.enabled ? "▶️ enabled" : "⏸️ paused";
          const last = s.last_run_at ? `last ${s.last_run_at}` : "never run";
          const next = s.next_run_at ?? "—";
          return `- **${s.name}** (id ${s.id}) — squad \`${s.squad_slug}\` — ${enabled}\n    cron: \`${s.cron_expr}\` — agenda: ${s.agenda.join(", ")}\n    next: ${next} — ${last}${s.notes ? `\n    notes: ${s.notes}` : ""}`;
        })
        .join("\n");
    },
  });

  const squadScheduleDelete = defineTool("squad_schedule_delete", {
    description: "Delete a squad schedule by id.",
    skipPermission: true,
    parameters: z.object({
      id: z.number().int().describe("Schedule id (from squad_schedule_list)"),
    }),
    handler: async ({ id }) => {
      const existing = getSchedule(id);
      if (!existing) return `Schedule ${id} not found.`;
      deleteSchedule(id);
      return `🗑️ Deleted schedule "${existing.name}" (id ${id}).`;
    },
  });

  const squadSchedulePause = defineTool("squad_schedule_pause", {
    description: "Pause a squad schedule so it stops firing (preserves config).",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const existing = getSchedule(id);
      if (!existing) return `Schedule ${id} not found.`;
      setScheduleEnabled(id, false);
      return `⏸️ Paused schedule "${existing.name}" (id ${id}).`;
    },
  });

  const squadScheduleResume = defineTool("squad_schedule_resume", {
    description:
      "Resume a paused squad schedule. The next run is computed from now using the stored cron expression.",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const existing = getSchedule(id);
      if (!existing) return `Schedule ${id} not found.`;
      setScheduleEnabled(id, true);
      try {
        const next = nextRun(existing.cron_expr);
        // Update next_run_at via the store's helper would be cleaner, but we
        // can also just re-run reconcile on next tick. Inline update:
        const { updateNextRun } = await import("../store/schedules.js");
        updateNextRun(id, next.toISOString());
        return `▶️ Resumed schedule "${existing.name}" (id ${id}). Next run: ${next.toISOString()}`;
      } catch (err) {
        return `Resumed schedule "${existing.name}" but failed to compute next run: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const squadScheduleRunNow = defineTool("squad_schedule_run_now", {
    description:
      "Manually fire a squad schedule immediately (useful for testing). last_run_at and next_run_at are preserved so the regular schedule is untouched.",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const result = await runScheduleNow(id);
      if (!result.ok) return `Failed: ${result.error}`;
      return `🚀 Fired schedule ${id} now. Use squad_task_status to follow the resulting stand-up.`;
    },
  });

  // -------------------------------------------------------------------------
  // IO-level (squad-independent) schedules.
  // -------------------------------------------------------------------------
  const scheduleCreate = defineTool("schedule_create", {
    description:
      "Schedule a recurring task for IO itself (no squad required). At the scheduled time, the prompt is delivered to the orchestrator as a background message, just like any TUI/Telegram input. Use for daily digests, health checks, monitoring, or any automation that does not belong to a project squad.",
    skipPermission: true,
    parameters: z.object({
      name: z
        .string()
        .describe(
          "Human-friendly name, e.g. 'Morning digest' or 'Hourly health check'",
        ),
      cron: z
        .string()
        .describe(
          "Standard 5-field cron expression: 'minute hour dom month dow'. Examples: '0 5 * * *' = daily at 5:00, '0 9 * * 1-5' = 9AM weekdays, '*/15 * * * *' = every 15 minutes.",
        ),
      prompt: z
        .string()
        .describe(
          "The prompt to send to the orchestrator each time the schedule fires. Treat it like the message a user would type — concrete, action-oriented.",
        ),
      notes: z
        .string()
        .optional()
        .describe("Optional operator notes appended to the prompt."),
    }),
    handler: async ({ name, cron, prompt, notes }) => {
      const v = validateCron(cron);
      if (!v.ok) return `Invalid cron expression: ${v.error}`;
      const created = createIoSchedule({
        name,
        cronExpr: cron,
        prompt,
        notes: notes ?? null,
        nextRunAt: v.next.toISOString(),
      });
      return `⏰ Scheduled IO task "${created.name}" (id ${created.id}).\n- Cron: \`${cron}\`\n- Next run: ${v.next.toISOString()}`;
    },
  });

  const scheduleList = defineTool("schedule_list", {
    description:
      "List all IO-level schedules (those not attached to a squad). For squad schedules, use squad_schedule_list.",
    skipPermission: true,
    parameters: z.object({}),
    handler: async () => {
      const schedules = listIoSchedules();
      if (schedules.length === 0) {
        return "No IO schedules configured.";
      }
      return schedules
        .map((s) => {
          const enabled = s.enabled ? "▶️ enabled" : "⏸️ paused";
          const last = s.last_run_at ? `last ${s.last_run_at}` : "never run";
          const next = s.next_run_at ?? "—";
          const promptPreview =
            s.prompt.length > 120 ? s.prompt.slice(0, 120) + "…" : s.prompt;
          return `- **${s.name}** (id ${s.id}) — ${enabled}\n    cron: \`${s.cron_expr}\`\n    next: ${next} — ${last}\n    prompt: ${promptPreview.replace(/\n/g, " ")}${s.notes ? `\n    notes: ${s.notes}` : ""}`;
        })
        .join("\n");
    },
  });

  const scheduleDelete = defineTool("schedule_delete", {
    description: "Delete an IO schedule by id.",
    skipPermission: true,
    parameters: z.object({
      id: z.number().int().describe("Schedule id (from schedule_list)"),
    }),
    handler: async ({ id }) => {
      const existing = getIoSchedule(id);
      if (!existing) return `IO schedule ${id} not found.`;
      deleteIoSchedule(id);
      return `🗑️ Deleted IO schedule "${existing.name}" (id ${id}).`;
    },
  });

  const schedulePause = defineTool("schedule_pause", {
    description:
      "Pause an IO schedule so it stops firing (preserves config — resume with schedule_resume).",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const existing = getIoSchedule(id);
      if (!existing) return `IO schedule ${id} not found.`;
      setIoScheduleEnabled(id, false);
      return `⏸️ Paused IO schedule "${existing.name}" (id ${id}).`;
    },
  });

  const scheduleResume = defineTool("schedule_resume", {
    description:
      "Resume a paused IO schedule. The next run is computed from now using the stored cron expression.",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const existing = getIoSchedule(id);
      if (!existing) return `IO schedule ${id} not found.`;
      setIoScheduleEnabled(id, true);
      try {
        const next = nextRun(existing.cron_expr);
        updateIoScheduleNextRun(id, next.toISOString());
        return `▶️ Resumed IO schedule "${existing.name}" (id ${id}). Next run: ${next.toISOString()}`;
      } catch (err) {
        return `Resumed IO schedule "${existing.name}" but failed to compute next run: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  const scheduleRunNow = defineTool("schedule_run_now", {
    description:
      "Manually fire an IO schedule immediately (useful for testing). last_run_at and next_run_at are preserved so the regular schedule is untouched.",
    skipPermission: true,
    parameters: z.object({ id: z.number().int().describe("Schedule id") }),
    handler: async ({ id }) => {
      const ok = await runIoScheduleNow(id);
      if (!ok) return `IO schedule ${id} not found.`;
      return `🚀 Fired IO schedule ${id} now.`;
    },
  });

  return [wikiRead, wikiWrite, wikiSearch, wikiDelete, wikiList, squadCreate, squadRecall, squadStatus, squadLogDecision, squadDelegate, squadTaskStatus, squadDelete, squadAnalyze, squadAddAgent, squadAgents, squadRemoveAgent, squadResetAgent, squadSetLead, squadSetQA, squadTaskReviews, squadScheduleCreate, squadScheduleList, squadScheduleDelete, squadSchedulePause, squadScheduleResume, squadScheduleRunNow, scheduleCreate, scheduleList, scheduleDelete, schedulePause, scheduleResume, scheduleRunNow, skillList, skillInstall, skillRemove, skillSearch, configUpdate, checkUpdate, shell, fileOps, bash, readFile, viewTool, grepTool, strReplaceEditor, github];
}

function walkDirectory(dir: string, maxDepth = 3, depth = 0): string[] {
  if (depth >= maxDepth) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(`${entry.name}/`);
      results.push(...walkDirectory(full, maxDepth, depth + 1).map((f) => `  ${entry.name}/${f}`));
    } else {
      results.push(entry.name);
    }
  }
  return results;
}
