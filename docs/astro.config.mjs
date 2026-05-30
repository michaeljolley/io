import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://michaeljolley.github.io',
	base: '/io',
	integrations: [
		starlight({
			title: 'IO',
			description: 'AI Orchestrator Daemon — manage specialized agent squads for your software projects',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/michaeljolley/io' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
						{ label: 'Orchestrator', slug: 'architecture/orchestrator' },
						{ label: 'Squads', slug: 'architecture/squads' },
						{ label: 'Event Bus', slug: 'architecture/event-bus' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Hiring a Squad', slug: 'guides/hiring-a-squad' },
							{ label: 'Wiki Knowledge Base', slug: 'guides/wiki' },
							{ label: 'Skills', slug: 'guides/skills' },
							{ label: 'Inbox & Notifications', slug: 'guides/inbox' },
							{ label: 'Schedules', slug: 'guides/schedules' },
							{ label: 'Configuration', slug: 'guides/configuration' },
							{ label: 'Telegram Setup', slug: 'guides/telegram-setup' },
						],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'REST Endpoints', slug: 'api/rest-endpoints' },
						{ label: 'WebSocket Protocol', slug: 'api/websocket' },
					],
				},
			],
		}),
	],
});
