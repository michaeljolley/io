import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		projects: ['packages/shared', 'packages/daemon', 'packages/tui', 'packages/telegram'],
		passWithNoTests: true,
	},
});
