import { useAuthStore } from "@/stores/auth";

const BASE_URL = "/api";

async function getHeaders(): Promise<HeadersInit> {
  const auth = useAuthStore();
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (auth.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  return headers;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: await getHeaders() });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: await getHeaders(),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function createEventSource(): EventSource {
  const auth = useAuthStore();
  const url = `${BASE_URL}/stream?token=${auth.token ?? ""}`;
  return new EventSource(url);
}
