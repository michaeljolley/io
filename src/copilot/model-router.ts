import { loadConfig, type Config } from "../config.js";

export type ModelTier = "high" | "medium" | "low";

export function selectModel(tier: ModelTier): string {
  const config = loadConfig();
  const models = config.modelTiers[tier];
  // Return first available model in the tier's preference list
  return models[0] ?? config.defaultModel;
}

export function classifyComplexity(task: string): ModelTier {
  const lower = task.toLowerCase();

  // High complexity indicators
  const highPatterns = [
    "architect",
    "design system",
    "refactor",
    "security audit",
    "performance optimization",
    "migration",
    "complex",
    "deep analysis",
  ];
  if (highPatterns.some((p) => lower.includes(p))) return "high";

  // Low complexity indicators
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

  // Default to medium
  return "medium";
}
