import { CopilotClient } from "@github/copilot-sdk";
import { getGhToken } from "./gh-token.js";

let client: CopilotClient | undefined;

export function getCopilotClientOptions(): ConstructorParameters<typeof CopilotClient>[0] {
  const githubToken = getGhToken();
  return githubToken ? { githubToken } : {};
}

export async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient(getCopilotClientOptions());
    await client.start();
  }
  return client;
}

export async function resetClient(): Promise<CopilotClient> {
  if (client) {
    try {
      await client.stop();
    } catch {
      // ignore stop errors during reset
    }
    client = undefined;
  }
  return getClient();
}

export function getClientInstance(): CopilotClient | undefined {
  return client;
}
