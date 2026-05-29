export interface ParsedSkillFrontmatter {
  frontmatter: Record<string, string | number | boolean | string[]>;
  body: string;
  hasFrontmatter: boolean;
}

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/;

function parseScalar(value: string): string | number | boolean | string[] {
  const trimmed = value.trim();

  if (trimmed === "") {
    return "";
  }

  if (/^\[(.*)\]$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === "") return [];
    return inner
      .split(",")
      .map((item) => parseScalar(item))
      .filter(
        (item): item is string | number | boolean =>
          typeof item === "string" || typeof item === "number" || typeof item === "boolean"
      ) as string[];
  }

  if (/^(true|false)$/i.test(trimmed)) {
    return trimmed.toLowerCase() === "true";
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function extractSkillFrontmatter(content: string): ParsedSkillFrontmatter {
  const match = content.match(FRONTMATTER_RE);

  if (!match) {
    return {
      frontmatter: {},
      body: content,
      hasFrontmatter: false,
    };
  }

  const frontmatterLines = match[1].replace(/\r/g, "").split("\n");
  const frontmatter: Record<string, string | number | boolean | string[]> = {};
  let currentKey: string | null = null;
  let currentList: string[] = [];

  for (const line of frontmatterLines) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (trimmed.startsWith("- ")) {
      if (currentKey) {
        currentList.push(String(parseScalar(trimmed.slice(2))));
      }
      continue;
    }

    if (currentKey) {
      frontmatter[currentKey] = currentList;
      currentKey = null;
      currentList = [];
    }

    const divider = trimmed.indexOf(":");
    if (divider === -1) {
      continue;
    }

    const key = trimmed.slice(0, divider).trim();
    const rawValue = trimmed.slice(divider + 1).trim();

    if (rawValue === "") {
      currentKey = key;
      currentList = [];
      continue;
    }

    frontmatter[key] = parseScalar(rawValue);
  }

  if (currentKey) {
    frontmatter[currentKey] = currentList;
  }

  return {
    frontmatter,
    body: content.slice(match[0].length).replace(/^\n+/, ""),
    hasFrontmatter: true,
  };
}
