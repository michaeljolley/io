import { useAuthStore } from "@/stores/auth";
import { router } from "@/router";

const BASE_URL = "/api";

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Consider expired if within 60 seconds of expiry
    return payload.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

async function getHeaders(): Promise<HeadersInit> {
  const auth = useAuthStore();
  const headers: HeadersInit = { "Content-Type": "application/json" };

  // Proactively refresh if token is expired or about to expire
  if (auth.token && isTokenExpired(auth.token)) {
    await auth.refreshToken();
  }

  if (auth.token) {
    headers["Authorization"] = `Bearer ${auth.token}`;
  }
  return headers;
}

async function handleResponse(res: Response, retryFn: () => Promise<Response>): Promise<Response> {
  if (res.status === 401) {
    const auth = useAuthStore();
    try {
      await auth.refreshToken();
      if (auth.token) {
        // Retry the request with the new token
        const retryRes = await retryFn();
        if (retryRes.status === 401) {
          auth.logout();
          router.push("/login");
          throw new Error("Session expired");
        }
        return retryRes;
      }
    } catch {
      // Refresh failed
    }
    auth.logout();
    router.push("/login");
    throw new Error("Session expired");
  }
  return res;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const res = await handleResponse(
    await fetch(`${BASE_URL}${path}`, { headers: await getHeaders() }),
    async () => fetch(`${BASE_URL}${path}`, { headers: await getHeaders() })
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
  const opts = {
    method: "POST",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await handleResponse(await fetch(`${BASE_URL}${path}`, opts), async () =>
    fetch(`${BASE_URL}${path}`, { ...opts, headers: await getHeaders() })
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
  const opts = {
    method: "PUT",
    headers: await getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  };
  const res = await handleResponse(await fetch(`${BASE_URL}${path}`, opts), async () =>
    fetch(`${BASE_URL}${path}`, { ...opts, headers: await getHeaders() })
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  const opts = { method: "DELETE", headers: await getHeaders() };
  const res = await handleResponse(await fetch(`${BASE_URL}${path}`, opts), async () =>
    fetch(`${BASE_URL}${path}`, { ...opts, headers: await getHeaders() })
  );
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export function createEventSource(): EventSource {
  const auth = useAuthStore();
  const url = `${BASE_URL}/stream?token=${auth.token ?? ""}`;
  return new EventSource(url);
}
