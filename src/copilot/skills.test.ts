/**
 * Tests for src/copilot/skills.ts — skill installation, listing, and management.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  listSkills,
  parseSkillUrl,
  removeSkill,
  updateSkill,
  deleteSkill,
} from "./skills.js";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("parseSkillUrl", () => {
  it("parses GitHub blob URLs for SKILL.md", () => {
    const url = "https://github.com/owner/repo/blob/main/SKILL.md";
    const result = parseSkillUrl(url);
    assert.equal(result.type, "file");
    assert.ok("rawUrl" in result);
    assert.ok((result as any).rawUrl.includes("raw.githubusercontent.com"));
  });

  it("parses GitHub raw content URLs", () => {
    const url = "https://raw.githubusercontent.com/owner/repo/main/SKILL.md";
    const result = parseSkillUrl(url);
    assert.equal(result.type, "file");
    assert.ok("rawUrl" in result);
  });

  it("parses GitHub repo URLs as repo type", () => {
    const url = "https://github.com/owner/repo";
    const result = parseSkillUrl(url);
    assert.equal(result.type, "repo");
    assert.equal((result as any).url, url);
  });

  it("rejects non-https SKILL.md URLs", () => {
    const url = "http://example.com/SKILL.md";
    assert.throws(() => parseSkillUrl(url));
  });

  it("derives slug from repo name with path prefix", () => {
    const url = "https://github.com/owner/repo/blob/main/skills/ai-chat/SKILL.md";
    const result = parseSkillUrl(url);
    assert.equal(result.type, "file");
    assert.ok((result as any).slug.includes("repo"));
  });
});

describe("skill store functions", () => {
  it("exports updateSkill function", () => {
    assert.ok(typeof updateSkill === "function");
  });

  it("exports deleteSkill function", () => {
    assert.ok(typeof deleteSkill === "function");
  });

  it("exports removeSkill function", () => {
    assert.ok(typeof removeSkill === "function");
  });

  it("deleteSkill is callable (alias)", () => {
    // Just verify these are functions and importable
    assert.ok(deleteSkill !== undefined);
    assert.ok(removeSkill !== undefined);
  });
});
