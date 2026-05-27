function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

export function getSquadLabelStyle(color: string): Record<string, string> {
  const rgb = parseHex(color);
  if (!rgb) return {};
  // ITU BT.601 relative luminance approximation to pick readable foreground text.
  const luma = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  const textColor = luma > 145 ? "#111827" : "#f9fafb";
  return {
    backgroundColor: color,
    color: textColor,
  };
}
