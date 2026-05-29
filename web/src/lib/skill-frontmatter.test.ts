import test from "node:test";
import assert from "node:assert/strict";
import { extractSkillFrontmatter } from "./skill-frontmatter";

test("extractSkillFrontmatter parses YAML frontmatter and removes it from content", () => {
  const content = `---
title: Example Skill
description: A sample skill
version: 1.2.3
enabled: true
count: 3
tags:
  - alpha
  - beta
---

# Heading

Body text`;

  const parsed = extractSkillFrontmatter(content);

  assert.equal(parsed.hasFrontmatter, true);
  assert.equal(parsed.frontmatter.title, "Example Skill");
  assert.equal(parsed.frontmatter.description, "A sample skill");
  assert.equal(parsed.frontmatter.version, "1.2.3");
  assert.equal(parsed.frontmatter.enabled, true);
  assert.equal(parsed.frontmatter.count, 3);
  assert.deepEqual(parsed.frontmatter.tags, ["alpha", "beta"]);
  assert.equal(parsed.body.trim(), "# Heading\n\nBody text");
});

test("extractSkillFrontmatter returns original content when no frontmatter is present", () => {
  const content = "# Heading\n\nBody text";
  const parsed = extractSkillFrontmatter(content);

  assert.equal(parsed.hasFrontmatter, false);
  assert.deepEqual(parsed.frontmatter, {});
  assert.equal(parsed.body, content);
});
