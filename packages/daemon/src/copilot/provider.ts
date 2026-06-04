import type { ByokConfig } from '@io/shared';

type ProviderConfig =
	| { type: 'openai'; baseUrl: string; apiKey: string }
	| { type: 'azure'; baseUrl: string; apiKey: string }
	| { type: 'anthropic'; baseUrl: string; apiKey: string };

export function buildProvider(byok: ByokConfig | null | undefined): ProviderConfig | undefined {
	if (!byok) return undefined;
	return { type: byok.type, baseUrl: byok.baseUrl, apiKey: byok.apiKey };
}
