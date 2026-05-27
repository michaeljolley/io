import type { CopilotSession } from "@github/copilot-sdk";
import { loadConfig } from "../config.js";
import { recordTokenUsage } from "../store/token-usage.js";
import { postFeedItem } from "../store/feed.js";

/**
 * Default model pricing (USD per 1M tokens).
 * Used when modelPricing is not configured.
 */
export const DEFAULT_MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0 },
  "gpt-5.2": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-5.2-codex": { inputPer1M: 3.0, outputPer1M: 12.0 },
  "gpt-5.3-codex": { inputPer1M: 3.0, outputPer1M: 12.0 },
  "gpt-5.4": { inputPer1M: 5.0, outputPer1M: 20.0 },
  "gpt-5.5": { inputPer1M: 7.5, outputPer1M: 30.0 },
  "gpt-5-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "gpt-5.4-mini": { inputPer1M: 0.15, outputPer1M: 0.60 },
  "claude-haiku-4.5": { inputPer1M: 0.80, outputPer1M: 4.0 },
  "claude-sonnet-4.5": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-sonnet-4.6": { inputPer1M: 3.0, outputPer1M: 15.0 },
  "claude-opus-4.5": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-opus-4.6": { inputPer1M: 15.0, outputPer1M: 75.0 },
  "claude-opus-4.7": { inputPer1M: 15.0, outputPer1M: 75.0 },
};

/**
 * Compute estimated cost in USD for the given token counts and model.
 */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const config = loadConfig();
  const pricing: { inputPer1M: number; outputPer1M: number } | undefined =
    config.modelPricing?.[model] ?? DEFAULT_MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
}

interface UsageAccumulator {
  [model: string]: { inputTokens: number; outputTokens: number };
}

/**
 * Attach a token usage listener to a CopilotSession.
 * Returns a `flush` function that, when called, persists accumulated
 * token usage to the database and returns the totals.
 *
 * Call `flush` after the session ends (in a finally block).
 */
export function attachTokenTracker(
  session: CopilotSession,
  context: {
    squadId?: string;
    agentId?: string;
    taskId?: string;
  }
): () => { totalInputTokens: number; totalOutputTokens: number; totalCostUsd: number } {
  const accumulator: UsageAccumulator = {};

  const unsubscribe = session.on("assistant.usage" as any, (event: any) => {
    const data = event?.data;
    if (!data?.model) return;
    const model: string = data.model;
    const input: number = data.inputTokens ?? 0;
    const output: number = data.outputTokens ?? 0;
    if (!accumulator[model]) accumulator[model] = { inputTokens: 0, outputTokens: 0 };
    accumulator[model].inputTokens += input;
    accumulator[model].outputTokens += output;
  });

  return () => {
    unsubscribe();

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostUsd = 0;

    for (const [model, usage] of Object.entries(accumulator)) {
      if (usage.inputTokens === 0 && usage.outputTokens === 0) continue;
      const costUsd = estimateCost(model, usage.inputTokens, usage.outputTokens);
      recordTokenUsage({
        squadId: context.squadId,
        agentId: context.agentId,
        taskId: context.taskId,
        model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd,
      });
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalCostUsd += costUsd;
    }

    // Alert on runaway agents
    const config = loadConfig();
    const threshold = config.tokenAlertThreshold;
    if (threshold && (totalInputTokens + totalOutputTokens) > threshold) {
      const source = context.squadId ? `squad-${context.squadId}` : "system";
      postFeedItem(
        source,
        "⚠️ Token usage alert",
        `A task consumed ${totalInputTokens + totalOutputTokens} tokens (threshold: ${threshold}). ` +
          `Estimated cost: $${totalCostUsd.toFixed(4)}. ` +
          (context.taskId ? `Task ID: ${context.taskId}` : "")
      );
    }

    return { totalInputTokens, totalOutputTokens, totalCostUsd };
  };
}
