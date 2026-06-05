import type { AppSettings, Schedule } from "@io/shared";

const API_BASE = "/api";

// Global token getter — set by AuthProvider
let getAccessToken: (() => string | null) | null = null;
// Global token refresher — set by AuthProvider
let refreshAccessToken: (() => Promise<string | null>) | null = null;

interface LegacyConfig {
	apiPort: number;
	logLevel: string;
	defaultModel: string;
	maxInstancesPerSquad: number;
	dataDir: string;
	timezone: string;
	pricing: { refreshIntervalHours: number };
	telegram: { botToken: string | null; allowedChatIds: number[] };
	supabase: { projectUrl: string | null; anonKey: string | null; jwtSecret: string | null };
	sessionResetThreshold: number;
}

export function setTokenGetter(getter: () => string | null) {
	getAccessToken = getter;
}

export function setTokenRefresher(refresher: () => Promise<string | null>) {
	refreshAccessToken = refresher;
}

export function getCurrentToken(): string | null {
	return getAccessToken?.() ?? null;
}

function splitPath(path: string) {
	const [pathname = "", query = ""] = path.split("?");
	return { pathname, query: query ? `?${query}` : "" };
}

function toLegacyConfig(settings: AppSettings): LegacyConfig {
	const chatId = Number(settings.telegramUserId);
	return {
		apiPort: settings.port,
		logLevel: settings.logLevel,
		defaultModel: settings.defaultModel,
		maxInstancesPerSquad: 3,
		dataDir: "~/.io",
		timezone: "UTC",
		pricing: { refreshIntervalHours: 24 },
		telegram: {
			botToken: settings.telegramToken,
			allowedChatIds: Number.isFinite(chatId) ? [chatId] : [],
		},
		supabase: {
			projectUrl: settings.supabaseUrl,
			anonKey: settings.supabaseAnonKey,
			jwtSecret: null,
		},
		sessionResetThreshold: settings.sessionResetThreshold,
	};
}

function normalizeSchedule(schedule: Schedule & Record<string, unknown>) {
	return {
		...schedule,
		cron: schedule.cronExpression,
		lastRun: schedule.lastRunAt,
		nextRun: schedule.nextRunAt,
		targetType: (schedule.targetType as string | undefined) ?? "orchestrator",
		targetId: (schedule.targetId as string | null | undefined) ?? null,
	};
}

function normalizeConfigBody(body: unknown) {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return body;
	}

	const config = body as Record<string, unknown>;
	const telegram = (config.telegram as Record<string, unknown> | undefined) ?? {};
	const supabase = (config.supabase as Record<string, unknown> | undefined) ?? {};
	const allowedChatIds = Array.isArray(telegram.allowedChatIds)
		? telegram.allowedChatIds.filter((value): value is number => typeof value === "number")
		: [];

	return {
		port: config.apiPort ?? config.port,
		logLevel: config.logLevel,
		defaultModel: config.defaultModel,
		telegramToken: telegram.botToken ?? config.telegramToken ?? null,
		telegramUserId:
			allowedChatIds.length > 0 ? String(allowedChatIds[0]) : (config.telegramUserId ?? null),
		supabaseUrl: supabase.projectUrl ?? config.supabaseUrl ?? null,
		supabaseAnonKey: supabase.anonKey ?? config.supabaseAnonKey ?? null,
		sessionResetThreshold: config.sessionResetThreshold,
	};
}

function normalizeScheduleBody(body: unknown) {
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return body;
	}

	const schedule = body as Record<string, unknown>;
	return {
		name: schedule.name,
		cronExpression: schedule.cronExpression ?? schedule.cron,
		prompt: schedule.prompt,
		enabled: schedule.enabled,
	};
}

function normalizeRequest(path: string, method: string, body?: unknown) {
	const { pathname, query } = splitPath(path);
	let nextPath = pathname;
	let nextMethod = method;
	let nextBody = body;

	if (pathname === "/config") {
		nextPath = "/settings";
		nextBody = normalizeConfigBody(body);
	}

	if (pathname === "/skills/discover" && nextMethod === "GET") {
		return { path: `${nextPath}${query}`, method: nextMethod, body: nextBody };
	}

	if (/^\/inbox\/[^/]+\/read$/.test(pathname)) {
		nextMethod = "PUT";
		nextBody = {};
	}

	if (nextMethod === "PATCH" && pathname.startsWith("/schedules/")) {
		nextMethod = "PUT";
		nextBody = normalizeScheduleBody(body);
	}

	if (nextMethod === "POST" && pathname === "/schedules") {
		nextBody = normalizeScheduleBody(body);
	}

	return { path: `${nextPath}${query}`, method: nextMethod, body: nextBody };
}

function normalizeResponse(path: string, data: unknown) {
	const { pathname } = splitPath(path);

	if (pathname === "/config" && data && typeof data === "object" && "port" in data) {
		return { config: toLegacyConfig(data as AppSettings) };
	}

	if (pathname === "/squads" && Array.isArray(data)) {
		return { squads: data };
	}

	if (pathname === "/schedules" && Array.isArray(data)) {
		return {
			schedules: data.map((schedule) =>
				normalizeSchedule(schedule as Schedule & Record<string, unknown>),
			),
		};
	}

	if (pathname === "/skills" && Array.isArray(data)) {
		return { skills: data };
	}

	if (pathname === "/skills/discover" && Array.isArray(data)) {
		return { skills: data };
	}

	if (pathname === "/inbox" && data && typeof data === "object" && "data" in data) {
		const payload = data as { data?: unknown };
		return { entries: Array.isArray(payload.data) ? payload.data : [] };
	}

	return data;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const {
		path: normalizedPath,
		method,
		body,
	} = normalizeRequest(
		path,
		options?.method ?? "GET",
		options?.body ? JSON.parse(options.body as string) : undefined,
	);
	const token = getAccessToken?.();
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...(options?.headers as Record<string, string>),
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const requestOptions: RequestInit = {
		...options,
		method,
		headers,
		body: body == null ? undefined : JSON.stringify(body),
	};

	let res = await fetch(`${API_BASE}${normalizedPath}`, requestOptions);

	if (res.status === 401 && refreshAccessToken) {
		const newToken = await refreshAccessToken();
		if (newToken) {
			headers.Authorization = `Bearer ${newToken}`;
			res = await fetch(`${API_BASE}${normalizedPath}`, { ...requestOptions, headers });
		}
	}

	if (!res.ok) {
		const responseBody = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(responseBody.error ?? `Request failed: ${res.status}`);
	}

	const responseBody = await res.json().catch(() => null);
	return normalizeResponse(path, responseBody) as T;
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) }),
	patch: <T>(path: string, body: unknown) =>
		request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
	put: <T>(path: string, body: unknown) =>
		request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
	delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
