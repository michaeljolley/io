import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": {
				target: "http://localhost:7777",
				changeOrigin: true,
			},
			"/ws": {
				target: "ws://localhost:7777",
				ws: true,
			},
		},
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
});
