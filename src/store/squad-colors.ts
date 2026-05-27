export const SQUAD_COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export function pickSquadColor(
  usedColors: string[],
  random: () => number = Math.random
): string {
  const used = new Set(usedColors.filter(Boolean).map((c) => c.toLowerCase()));
  const available = SQUAD_COLOR_PALETTE.filter((c) => !used.has(c.toLowerCase()));
  const source = available.length > 0 ? available : SQUAD_COLOR_PALETTE;
  const index = Math.floor(random() * source.length);
  return source[index]!;
}
