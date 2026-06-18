import { buildShellEnv } from "./shell-env.js";
import { PATHS } from "../paths.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";

const execAsync = promisify(exec);

describe("shell-env buildShellEnv", () => {
  it("ensures HOME is present in returned env (falls back to PATHS.home)", () => {
    const origHome = process.env.HOME;
    try {
      // Temporarily unset HOME to simulate the worktree agent environment
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete process.env.HOME;

      const env = buildShellEnv();
      assert.ok(env.HOME, "HOME should be set");
      assert.strictEqual(env.HOME, PATHS.home);
    } finally {
      if (origHome !== undefined) process.env.HOME = origHome;
    }
  });

  it("allows git to read a global config when HOME is set in the env passed to exec", async () => {
    const tempHome = join(tmpdir(), `io-test-home-${Date.now()}`);
    try {
      if (!existsSync(tempHome)) mkdirSync(tempHome, { recursive: true });
      // Write a minimal global git config
      const gitconfig = `[user]\n\tname = ShellEnvTestUser\n`;
      writeFileSync(join(tempHome, ".gitconfig"), gitconfig, { encoding: "utf8" });

      // Run git config --global user.name with HOME overridden via env
      const { stdout } = await execAsync("git config --global user.name", {
        env: { ...process.env, HOME: tempHome },
      });

      assert.strictEqual(stdout.trim(), "ShellEnvTestUser");
    } finally {
      try {
        rmSync(tempHome, { recursive: true, force: true });
      } catch {}
    }
  });
});
