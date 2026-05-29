export function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function logWarn(message: string, context: Record<string, unknown> = {}, err?: unknown): void {
  const payload = {
    ...context,
    ...(err ? { error: formatError(err) } : {}),
  };
  console.warn(`[io] ${message}`, payload);
}

export function logError(message: string, context: Record<string, unknown> = {}, err?: unknown): void {
  const payload = {
    ...context,
    ...(err ? { error: formatError(err) } : {}),
  };
  console.error(`[io] ${message}`, payload);
}
