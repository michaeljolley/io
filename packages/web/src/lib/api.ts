const API_BASE = '/api';

// Global token getter — set by AuthProvider
let getAccessToken: (() => string | null) | null = null;

export function setTokenGetter(getter: () => string | null) {
	getAccessToken = getter;
}

export function getCurrentToken(): string | null {
	return getAccessToken?.() ?? null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
	const token = getAccessToken?.();
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options?.headers as Record<string, string>),
	};

	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers,
	});

	if (!res.ok) {
		const body = await res.json().catch(() => ({ error: res.statusText }));
		throw new Error(body.error ?? `Request failed: ${res.status}`);
	}

	return res.json() as Promise<T>;
}

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, body?: unknown) =>
		request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
	patch: <T>(path: string, body: unknown) =>
		request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
	put: <T>(path: string, body: unknown) =>
		request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
	delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
