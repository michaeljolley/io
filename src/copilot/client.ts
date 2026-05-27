import { CopilotClient } from "@github/copilot-sdk";
import { PATHS } from "../paths.js";

let client: CopilotClient | undefined;

export async function getClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient();
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
