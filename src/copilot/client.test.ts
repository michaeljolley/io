import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, resetConfigCache, saveConfig } from "../config.js";
import { getCopilotClientOptions } from "./client.js";
import { resetGhTokenCache } from "./gh-token.js";

const originalConfig = loadConfig();
const originalGhToken = process.env.GH_TOKEN;
const originalGithubToken = process.env.GITHUB_TOKEN;

function restoreEnvironment(): void {
  if (originalGhToken === undefined) {
    delete process.env.GH_TOKEN;
  } else {
    process.env.GH_TOKEN = originalGhToken;
  }

  if (originalGithubToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = originalGithubToken;
  }
}

test("getCopilotClientOptions forwards configured github token from config", () => {
  resetGhTokenCache();
  resetConfigCache();
  process.env.GH_TOKEN = "";
  process.env.GITHUB_TOKEN = "";
  saveConfig({ githubToken: "test-github-token" });

  try {
    const options = getCopilotClientOptions();
    assert.deepEqual(options, { githubToken: "test-github-token" });
  } finally {
    resetGhTokenCache();
    resetConfigCache();
    restoreEnvironment();
    saveConfig({ githubToken: originalConfig.githubToken });
  }
});
