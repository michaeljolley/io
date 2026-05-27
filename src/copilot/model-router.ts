import { loadConfig } from "../config.js";
import { getClient } from "./client.js";

export type TaskComplexity = "high" | "medium" | "low";

interface ScoredModel {
  id: string;
  score: number;
}

// Cache discovered models so we don't call listModels() on every task
let discoveredModels: ScoredModel[] | undefined;

/**
 * Built-in model capability hints. Used as fallback when billing info
 * isn't available from the SDK. Higher = more capable.
 */
const MODEL_CAPABILITY_HINTS: Record<string, number> = {
  "claude-opus-4.7": 90,
  "claude-opus-4.6": 88,
  "claude-opus-4.5": 85,
  "gpt-5.5": 87,
  "gpt-5.4": 84,
  "gpt-5.3-codex": 83,
  "gpt-5.2-codex": 82,
  "gpt-5.2": 80,
  "claude-sonnet-4.6": 70,
  "claude-sonnet-4.5": 68,
  "gpt-4.1": 65,
  "claude-haiku-4.5": 40,
  "gpt-5.4-mini": 42,
  "gpt-5-mini": 38,
};

/**
 * Discover available models from the Copilot SDK and score them.
 * Uses billing multiplier as primary capability signal, falls back to
 * built-in hints for unknown models.
 */
export async function discoverModels(): Promise<ScoredModel[]> {
  if (discoveredModels) return discoveredModels;

  try {
    const client = await getClient();
    const models = await client.listModels();

    discoveredModels = models
      .filter((m) => !m.policy || m.policy.state === "enabled")
      .map((m) => ({
        id: m.id,
        // Use billing multiplier as capability proxy (higher cost = more capable)
        // Fall back to built-in hints, then default of 50
        score: m.billing
          ? Math.min(m.billing.multiplier * 10, 100)
          : (MODEL_CAPABILITY_HINTS[m.id] ?? 50),
      }))
      .sort((a, b) => b.score - a.score);
  } catch {
    // SDK discovery failed — fall back to defaultModel only
    const config = loadConfig();
    discoveredModels = [{ id: config.defaultModel, score: 65 }];
  }

  return discoveredModels;
}

/** Reset cached models (e.g. after client reconnect) */
export function resetModelCache(): void {
  discoveredModels = undefined;
}

/**
 * Select the best available model for a given task complexity.
 * Discovers models from the Copilot SDK and picks based on capability —
 * zero configuration required.
 */
export async function selectModel(complexity: TaskComplexity): Promise<string> {
  const config = loadConfig();
  const scored = await discoverModels();

  if (scored.length === 0) return config.defaultModel;

  if (complexity === "high") {
    // Most capable model
    return scored[0].id;
  }

  if (complexity === "low") {
    // Cheapest model
    return scored[scored.length - 1].id;
  }

  // Medium — pick a model around the middle of the ranked list
  const midIdx = Math.floor(scored.length / 2);
  return scored[midIdx].id;
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
