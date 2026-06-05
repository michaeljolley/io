import { defineConfig } from "vitepress";

export default defineConfig({
	title: "IO",
	description: "AI orchestrator daemon with squad-based team delegation",
	base: "/io/",
	head: [["link", { rel: "icon", href: "/io/logo.svg" }]],
	themeConfig: {
		logo: "/logo.svg",
		nav: [
			{ text: "Guide", link: "/guide/getting-started" },
			{ text: "Squads", link: "/squads/overview" },
			{ text: "Reference", link: "/reference/api" },
			{
				text: "Links",
				items: [
					{ text: "GitHub", link: "https://github.com/michaeljolley/io" },
					{ text: "npm", link: "https://www.npmjs.com/package/heyio" },
				],
			},
		],
		sidebar: {
			"/guide/": [
				{
					text: "Introduction",
					items: [
						{ text: "What is IO?", link: "/guide/what-is-io" },
						{ text: "Getting Started", link: "/guide/getting-started" },
						{ text: "Configuration", link: "/guide/configuration" },
					],
				},
				{
					text: "Features",
					items: [
						{ text: "Chat & Orchestration", link: "/guide/chat" },
						{ text: "Wiki", link: "/guide/wiki" },
						{ text: "Skills", link: "/guide/skills" },
						{ text: "Scheduler", link: "/guide/scheduler" },
						{ text: "Telegram", link: "/guide/telegram" },
					],
				},
			],
			"/squads/": [
				{
					text: "Squads",
					items: [
						{ text: "Overview", link: "/squads/overview" },
						{ text: "Hiring a Squad", link: "/squads/hiring" },
						{ text: "Execution Pipeline", link: "/squads/execution" },
						{ text: "PR Modes", link: "/squads/pr-modes" },
						{ text: "Model Routing", link: "/squads/model-routing" },
					],
				},
			],
			"/reference/": [
				{
					text: "Reference",
					items: [
						{ text: "REST API", link: "/reference/api" },
						{ text: "WebSocket Events", link: "/reference/websocket" },
						{ text: "CLI", link: "/reference/cli" },
						{ text: "Configuration", link: "/reference/config" },
						{ text: "Architecture", link: "/reference/architecture" },
					],
				},
			],
		},
		socialLinks: [{ icon: "github", link: "https://github.com/michaeljolley/io" }],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2024-present Michael Jolley",
		},
		search: {
			provider: "local",
		},
	},
});
