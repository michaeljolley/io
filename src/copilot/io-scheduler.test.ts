import assert from "node:assert/strict";
import test from "node:test";
import { buildSquadScopedPrompt } from "./io-scheduler.js";

test("buildSquadScopedPrompt includes squad context", () => {
  const prompt = buildSquadScopedPrompt({
    squad_id: "squad-123",
    prompt: "Share priorities for today",
  });

  assert.equal(
    prompt,
    "[Squad Schedule] Run for squad squad-123. Prompt: Share priorities for today"
  );
});
