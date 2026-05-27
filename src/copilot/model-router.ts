import { loadConfig } from "../config.js";

export type TaskComplexity = "high" | "medium" | "low";

/**
 * Built-in model capability rankings (higher = more capable).
 * The router uses this to match models to task complexity without
 * requiring the user to manually tier their models.
 */
const MODEL_CAPABILITY: Record<string, number> = {
  // Tier 3 — most capable (complex architecture, deep reasoning)
  "claude-opus-4.7": 90,
  "claude-opus-4.6": 88,
  "claude-opus-4.5": 85,
  "gpt-5.5": 87,
  "gpt-5.4": 84,
  "gpt-5.3-codex": 83,
  "gpt-5.2-codex": 82,
  "gpt-5.2": 80,

  // Tier 2 — balanced (features, tests, reviews)
  "claude-sonnet-4.6": 70,
  "claude-sonnet-4.5": 68,
  "gpt-4.1": 65,

  // Tier 1 — fast/cheap (lookups, formatting, simple edits)
  "claude-haiku-4.5": 40,
  "gpt-5.4-mini": 42,
  "gpt-5-mini": 38,
};

const COMPLEXITY_THRESHOLDS: Record<TaskComplexity, { min: number }> = {
  high: { min: 75 },
  medium: { min: 55 },
  low: { min: 0 },
};

/**
 * Select the best available model for a given task complexity.
 * Uses the user's configured `models` list filtered against built-in
 * capability scores — no manual tiering required.
 */
export function selectModel(complexity: TaskComplexity): string {
  const config = loadConfig();
  const available = config.models;
  const threshold = COMPLEXITY_THRESHOLDS[complexity].min;

  // Score and sort available models by capability (descending)
  const scored = available
    .map((m) => ({ model: m, score: MODEL_CAPABILITY[m] ?? 50 }))
    .sort((a, b) => b.score - a.score);

  // For high complexity, pick the most capable model above threshold
  // For low complexity, pick the least capable model (cheapest) that's still available
  if (complexity === "low") {
    // Pick cheapest model
    const cheapest = scored[scored.length - 1];
    return cheapest?.model ?? config.defaultModel;
  }

  // For medium/high, pick the best model at or above the threshold
  const suitable = scored.find((m) => m.score >= threshold);
  return suitable?.model ?? scored[0]?.model ?? config.defaultModel;
}

export function classifyComplexity(task: string): TaskComplexity {
  const lower = task.toLowerCase();

  const highPatterns = [
    "architect",
    "design system",
    "refactor",
    "security audit",
    "performance optimization",
    "migration",
    "complex",
    "deep analysis",
    "debug",
    "race condition",
  ];
  if (highPatterns.some((p) => lower.includes(p))) return "high";

  const lowPatterns = [
    "format",
    "rename",
    "typo",
    "simple",
    "lookup",
    "list",
    "read",
    "status",
    "check",
  ];
  if (lowPatterns.some((p) => lower.includes(p))) return "low";

  return "medium";
}
