import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
	'packages/shared',
	'packages/daemon',
	'packages/tui',
	'packages/telegram',
]);
