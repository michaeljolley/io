import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { CopilotClient, type CopilotClientOptions } from "@github/copilot-sdk";
import { DATA_DIR } from "@io/shared/paths";

const COPILOT_AUTH_ERROR_HINT =
	"Set GITHUB_TOKEN or authenticate with the GitHub CLI (`gh auth login`) so `gh auth token` returns a valid token.";
const COPILOT_BASE_DIRECTORY = join(DATA_DIR, "copilot-sdk");

let copilotClientSingleton: CopilotClient | null = null;
let copilotClientInitPromise: Promise<CopilotClient> | null = null;

function readTokenFromEnvironment(): string | undefined {
	const token = process.env.GITHUB_TOKEN?.trim();
	return token !== undefined && token.length > 0 ? token : undefined;
}

function readTokenFromGhCli(): string | undefined {
	try {
		const token = execFileSync("gh", ["auth", "token"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();

		return token.length > 0 ? token : undefined;
	} catch {
		return undefined;
	}
}

function resolveGitHubToken(): string | undefined {
	return readTokenFromEnvironment() ?? readTokenFromGhCli();
}

function buildClientOptions(token: string): CopilotClientOptions {
	mkdirSync(COPILOT_BASE_DIRECTORY, { recursive: true });

	return {
		mode: "empty",
		workingDirectory: process.cwd(),
		baseDirectory: COPILOT_BASE_DIRECTORY,
		gitHubToken: token,
		useLoggedInUser: false,
	};
}

function formatInitializationError(error: unknown): Error {
	const details = error instanceof Error ? error.message : String(error);
	return new Error(
		`Unable to initialize Copilot SDK client. ${details} ${COPILOT_AUTH_ERROR_HINT}`.trim(),
	);
}

async function validateAuthentication(client: CopilotClient): Promise<void> {
	const authStatus = await client.getAuthStatus();

	if (authStatus.isAuthenticated) {
		return;
	}

	const reason =
		authStatus.statusMessage?.trim() ||
		"GitHub authentication was rejected by the Copilot runtime.";
	throw new Error(reason);
}

export async function initCopilotClient(): Promise<CopilotClient> {
	if (copilotClientSingleton !== null) {
		return copilotClientSingleton;
	}

	if (copilotClientInitPromise !== null) {
		return copilotClientInitPromise;
	}

	copilotClientInitPromise = (async () => {
		try {
			const token = resolveGitHubToken();

			if (token === undefined) {
				throw new Error(
					`Unable to find a GitHub token for Copilot SDK authentication. ${COPILOT_AUTH_ERROR_HINT}`,
				);
			}

			const client = new CopilotClient(buildClientOptions(token));

			try {
				await client.start();
				await validateAuthentication(client);
				copilotClientSingleton = client;
				return client;
			} catch (error) {
				await client.stop().catch(() => undefined);
				throw formatInitializationError(error);
			}
		} finally {
			if (copilotClientSingleton === null) {
				copilotClientInitPromise = null;
			}
		}
	})();

	return copilotClientInitPromise;
}

export async function getCopilotClient(): Promise<CopilotClient> {
	return copilotClientSingleton ?? initCopilotClient();
}
