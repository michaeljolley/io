import { existsSync } from "node:fs";
import { type Server as HttpServer, createServer } from "node:http";
import { resolve } from "node:path";

import { API_HOST } from "@io/shared";
import express, { type Express, type NextFunction, type Request, type Response } from "express";

import { eventBus } from "../event-bus.js";
import { type AuthConfig, createAuthMiddleware } from "./auth.js";
import { initNotifications } from "./notifications.js";
import { activityRouter } from "./routes/activity.js";
import { chatRouter } from "./routes/chat.js";
import { inboxRouter } from "./routes/inbox.js";
import { schedulesRouter } from "./routes/schedules.js";
import { settingsRouter } from "./routes/settings.js";
import { skillsRouter } from "./routes/skills.js";
import { squadsRouter } from "./routes/squads.js";
import { usageRouter } from "./routes/usage.js";
import { wikiRouter } from "./routes/wiki.js";
import { initWebSocket } from "./websocket.js";

export interface ApiServerConfig extends AuthConfig {
	port: number;
	host?: string;
	webDir?: string;
}

export interface ApiServer {
	app: Express;
	server: HttpServer;
	start(): Promise<HttpServer>;
}

export function createApiServer(config: ApiServerConfig): ApiServer {
	const app = express();
	const server = createServer(app);
	const webDirectory = resolve(config.webDir ?? resolve(process.cwd(), "dist", "web"));

	app.use((req, res, next) => {
		res.header("Access-Control-Allow-Origin", "*");
		res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
		res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
		if (req.method === "OPTIONS") {
			res.status(204).end();
			return;
		}

		next();
	});
	app.use(express.json({ limit: "1mb" }));
	app.use("/api", createAuthMiddleware(config));
	app.use(chatRouter);
	app.use(squadsRouter);
	app.use(inboxRouter);
	app.use(schedulesRouter);
	app.use(wikiRouter);
	app.use(skillsRouter);
	app.use(usageRouter);
	app.use(settingsRouter);
	app.use(activityRouter);
	app.use("/api", (_req, res) => {
		res.status(404).json({ error: "API route not found" });
	});

	if (existsSync(webDirectory)) {
		app.use(express.static(webDirectory));
	}

	app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
		if (res.headersSent) {
			next(error);
			return;
		}

		const statusCode =
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			typeof error.status === "number"
				? error.status
				: 500;
		res.status(statusCode).json({
			error: statusCode === 500 ? "Internal server error" : "Request failed",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	});

	initWebSocket(server, eventBus);
	initNotifications(eventBus);

	let startPromise: Promise<HttpServer> | null = null;

	return {
		app,
		server,
		start() {
			if (server.listening) {
				return Promise.resolve(server);
			}

			if (startPromise) {
				return startPromise;
			}

			startPromise = new Promise<HttpServer>((resolveServer, rejectServer) => {
				const handleError = (error: Error) => {
					server.off("listening", handleListening);
					startPromise = null;
					rejectServer(error);
				};
				const handleListening = () => {
					server.off("error", handleError);
					resolveServer(server);
				};

				server.once("error", handleError);
				server.once("listening", handleListening);
				server.listen(config.port, config.host ?? API_HOST);
			});

			return startPromise;
		},
	};
}
