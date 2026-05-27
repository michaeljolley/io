import { homedir } from "node:os";
import { join } from "node:path";

const IO_HOME = join(homedir(), ".io");

export const PATHS = {
  home: IO_HOME,
  config: join(IO_HOME, "config.json"),
  db: join(IO_HOME, "io.db"),
  wiki: join(IO_HOME, "wiki"),
  wikiPages: join(IO_HOME, "wiki", "pages"),
  skills: join(IO_HOME, "skills"),
  mcpConfig: join(IO_HOME, "mcp.json"),
  sessions: join(IO_HOME, "sessions"),
} as const;
