import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { discoverSkills, isGitHubRepoPath, listSkills } from './skills.ts';
import { PATHS } from '../paths.ts';

test('isGitHubRepoPath accepts GitHub-style owner/repo paths', () => {
  assert.equal(isGitHubRepoPath('vercel/workflow'), true);
  assert.equal(isGitHubRepoPath('open.feishu.cn'), false);
});

test('discoverSkills filters unsupported skills.sh sources', async () => {
  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo | URL) => {
    if (String(input) === 'https://skills.sh/api/search?q=standup') {
      return new Response(
        JSON.stringify({
          skills: [
            {
              id: 'larksuite/cli/lark-workflow-standup-report',
              skillId: 'lark-workflow-standup-report',
              name: 'lark-workflow-standup-report',
              installs: 1,
              source: 'larksuite/cli',
            },
            {
              id: 'open.feishu.cn/lark-workflow-standup-report',
              skillId: 'lark-workflow-standup-report',
              name: 'lark-workflow-standup-report',
              installs: 2,
              source: 'open.feishu.cn',
            },
          ],
          count: 2,
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }
      ) as Response;
    }

    throw new Error(`Unexpected fetch target: ${String(input)}`);
  };

  try {
    const skills = await discoverSkills('skillssh', 'standup');
    assert.equal(skills.length, 1);
    assert.equal(skills[0].slug, 'lark-workflow-standup-report');
    assert.equal(skills[0].sourceRepo, 'larksuite/cli');
  } finally {
    global.fetch = originalFetch;
  }
});

test('discoverSkills uses remote frontmatter descriptions from SKILL.md content', async () => {
  const originalFetch = global.fetch;

  global.fetch = async (input: RequestInfo | URL) => {
    const target = String(input);

    if (target === 'https://skills.sh/api/search?q=standup') {
      return new Response(
        JSON.stringify({
          skills: [
            {
              id: 'larksuite/cli/lark-workflow-standup-report',
              skillId: 'lark-workflow-standup-report',
              name: 'lark-workflow-standup-report',
              installs: 1,
              source: 'larksuite/cli',
            },
          ],
          count: 1,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ) as Response;
    }

    if (target === 'https://api.github.com/repos/larksuite/cli/git/trees/main?recursive=1') {
      return new Response(
        JSON.stringify({
          tree: [
            {
              path: 'lark-workflow-standup-report/SKILL.md',
              type: 'blob',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ) as Response;
    }

    if (target === 'https://raw.githubusercontent.com/larksuite/cli/main/lark-workflow-standup-report/SKILL.md') {
      return new Response(
        '---\nname: Standup Report\ndescription: Remote frontmatter description\n---\n# Standup Report\n\nBody text.',
        {
          status: 200,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        },
      ) as Response;
    }

    throw new Error(`Unexpected fetch target: ${target}`);
  };

  try {
    const skills = await discoverSkills('skillssh', 'standup');

    assert.equal(skills.length, 1);
    assert.equal(skills[0].description, 'Remote frontmatter description');
    assert.notEqual(skills[0].description, '');
  } finally {
    global.fetch = originalFetch;
  }
});

test("listSkills handles CRLF line endings in frontmatter", async () => {
  const testSkillDir = join(PATHS.skills, "test-crlf-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const crlfContent =
      "---\r\nname: Test CRLF Skill\r\ndescription: A skill with CRLF endings\r\n---\r\n# Test CRLF Skill\r\n\r\nThis tests CRLF handling.";
    writeFileSync(join(testSkillDir, "SKILL.md"), crlfContent);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-crlf-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.name, "Test CRLF Skill");
    assert.equal(testSkill.description, "A skill with CRLF endings");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});

test("listSkills handles LF line endings in frontmatter", async () => {
  const testSkillDir = join(PATHS.skills, "test-lf-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const lfContent =
      "---\nname: Test LF Skill\ndescription: A skill with LF endings\n---\n# Test LF Skill\n\nThis tests LF handling.";
    writeFileSync(join(testSkillDir, "SKILL.md"), lfContent);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-lf-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.name, "Test LF Skill");
    assert.equal(testSkill.description, "A skill with LF endings");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});

test("listSkills extracts description from frontmatter, not body", async () => {
  const testSkillDir = join(PATHS.skills, "test-fm-desc-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const content = `---
name: Frontmatter Description Test
description: This is the frontmatter description
---
# Frontmatter Description Test

This is the body text which should NOT be used as description.
`;
    writeFileSync(join(testSkillDir, "SKILL.md"), content);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-fm-desc-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.description, "This is the frontmatter description");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});

test("listSkills falls back to body description when frontmatter has none", async () => {
  const testSkillDir = join(PATHS.skills, "test-no-fm-desc-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const content = `---
name: No Frontmatter Description
---
# No Frontmatter Description

Fallback description from body.
`;
    writeFileSync(join(testSkillDir, "SKILL.md"), content);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-no-fm-desc-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.description, "Fallback description from body.");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});

test("listSkills preserves quoted frontmatter descriptions", async () => {
  const testSkillDir = join(PATHS.skills, "test-quoted-desc-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const content = `---
name: Quoted Description Test
description: "A quoted description from frontmatter"
---
# Quoted Description Test

This body text should not be used.
`;
    writeFileSync(join(testSkillDir, "SKILL.md"), content);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-quoted-desc-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.description, "A quoted description from frontmatter");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});

test("listSkills preserves block-scalar frontmatter descriptions", async () => {
  const testSkillDir = join(PATHS.skills, "test-block-scalar-desc-skill");

  try {
    mkdirSync(testSkillDir, { recursive: true });

    const content = `---
name: Block Scalar Description Test
description: |
  First line of the block scalar
  Second line of the block scalar
---
# Block Scalar Description Test

This body text should not be used.
`;
    writeFileSync(join(testSkillDir, "SKILL.md"), content);

    const skills = await listSkills();
    const testSkill = skills.find((s) => s.slug === "test-block-scalar-desc-skill");

    assert.ok(testSkill, "Test skill should be found");
    assert.equal(testSkill.description, "First line of the block scalar\nSecond line of the block scalar");
  } finally {
    if (existsSync(testSkillDir)) {
      rmSync(testSkillDir, { recursive: true, force: true });
    }
  }
});
