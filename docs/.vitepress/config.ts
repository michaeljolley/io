import { defineConfig } from "vitepress";

export default defineConfig({
  title: "IO",
  description: "A personal AI assistant daemon built on the GitHub Copilot SDK",
  base: "/io/",
  head: [["link", { rel: "icon", href: "/io/favicon.svg" }]],
  themeConfig: {
    logo: "/favicon.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Architecture", link: "/architecture/overview" },
      { text: "Reference", link: "/reference/cli" },
      {
        text: "GitHub",
        link: "https://github.com/michaeljolley/io",
      },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/guide/getting-started" },
          { text: "Configuration", link: "/guide/configuration" },
          { text: "Telegram", link: "/guide/telegram" },
          { text: "Web Dashboard", link: "/guide/web-dashboard" },
          { text: "Skills", link: "/guide/skills" },
          { text: "MCP Servers", link: "/guide/mcp" },
          { text: "Troubleshooting", link: "/guide/troubleshooting" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "Overview", link: "/architecture/overview" },
          { text: "Orchestrator", link: "/architecture/orchestrator" },
          { text: "Squad System", link: "/architecture/squads" },
          { text: "Wiki & Knowledge", link: "/architecture/wiki" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI Commands", link: "/reference/cli" },
          { text: "API Endpoints", link: "/reference/api" },
          { text: "Tools", link: "/reference/tools" },
        ],
      },
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/michaeljolley/io" },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Michael Jolley",
    },
    search: {
      provider: "local",
    },
  },
});
