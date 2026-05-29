import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverSkills, isGitHubRepoPath } from './skills.ts';

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
