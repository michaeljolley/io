export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0";

  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return "0";

  return num.toLocaleString();
}
