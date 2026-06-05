import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
	entryPoints: [
		resolve(root, "packages/daemon/src/cli.ts"),
		resolve(root, "packages/daemon/src/index.ts"),
	],
	bundle: true,
	platform: "node",
	target: "node22",
	format: "esm",
	outdir: resolve(root, "dist/daemon"),
	sourcemap: true,
	minify: false,
	external: [
		"@github/copilot-sdk",
		"@libsql/client",
		"@modelcontextprotocol/sdk",
		"cron-parser",
		"express",
		"grammy",
		"gray-matter",
		"jose",
		"pino",
		"pino-pretty",
		"ws",
		"zod",
		"better-sqlite3",
		"fsevents",
	],
	banner: {
		js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
	},
});

console.log("Daemon build complete → dist/daemon/");
