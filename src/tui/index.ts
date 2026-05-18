import { createInterface, type Interface } from "readline";
import { listRecentTasks, getTask } from "../store/tasks.js";
import { getTaskEvents } from "../copilot/agents.js";
import { summarize } from "../copilot/event-summary.js";
import {
  listFeedEntries,
  deleteFeedEntry,
  countUnreadFeedEntries,
} from "../store/feed.js";

export type TuiMessageHandler = (
  text: string,
  callback: (text: string, done: boolean) => void,
) => Promise<void>;

let messageHandler: TuiMessageHandler | undefined;

export function setMessageHandler(handler: TuiMessageHandler): void {
  messageHandler = handler;
}

const WELCOME_BANNER = `
╔══════════════════════════════════════╗
║          IO — AI Assistant           ║
╚══════════════════════════════════════╝
Type a message to chat. Commands:
  /status              — show status
  /activity [id|N]     — show summarized activity for a task (default: most recent)
  /verbose             — toggle verbose mode (raw event detail in /activity)
  /inbox               — list deliverables from the unified feed
  /inbox delete <id>   — delete a feed entry by ID
  /inbox clear         — delete all deliverables from the feed
  /quit                — exit
`;

let verbose = false;

// Held so printBackgroundNotification can redraw the prompt around notifications.
// Assigned inside startTui(); undefined when running headless (no TUI).
let activeInterface: Interface | undefined;

const NOTIFICATION_MAX_LINES = 6;
const NOTIFICATION_WRAP_WIDTH = 78;

/** Hard-wrap a single line to at most `width` visible chars, returning segments. */
function wrapLine(line: string, width: number): string[] {
  const segments: string[] = [];
  while (line.length > width) {
    segments.push(line.slice(0, width));
    line = line.slice(width);
  }
  segments.push(line);
  return segments;
}

/**
 * Print a background notification in a bordered block above the prompt,
 * preserving any in-progress readline input the user has typed.
 *
 * Format:
 *   ╭─🔔 Background update: <title>
 *   │ <line1>
 *   │ […N more lines — see /notifications]   (if truncated)
 *   ╰─
 *
 * Safe to call at any time, even before startTui(). Never throws.
 */
export function printBackgroundNotification(opts: {
  title: string;
  text: string;
}): void {
  try {
    // Build display lines from text, hard-wrapping long lines.
    const rawLines = opts.text.split(/\r?\n/);
    const displayLines: string[] = [];
    for (const raw of rawLines) {
      for (const seg of wrapLine(raw, NOTIFICATION_WRAP_WIDTH)) {
        displayLines.push(seg);
      }
    }

    const truncated = displayLines.length > NOTIFICATION_MAX_LINES;
    const visible = truncated ? displayLines.slice(0, NOTIFICATION_MAX_LINES) : displayLines;
    const extra = displayLines.length - NOTIFICATION_MAX_LINES;

    const top = "\u256d\u2500\ud83d\udd14 Background update: " + opts.title + "\n";
    const body = visible.map((l) => "\u2502 " + l).join("\n");
    const overflow = truncated
      ? "\n\u2502 [\u2026" + extra + " more line" + (extra === 1 ? "" : "s") + " \u2014 see /notifications]"
      : "";
    const bottom = "\n\u2570\u2500\n";
    const block = top + body + overflow + bottom;

    if (!activeInterface) {
      // Headless daemon — no readline interface live; plain log is fine.
      process.stdout.write(block);
      return;
    }

    // Capture whatever the user has typed so far.
    // readline stores the pending input in `rl.line` (stable internal property).
    const currentLine = (activeInterface as unknown as { line: string }).line ?? "";

    // Clear the current prompt+input line, print the notification, then
    // redraw the prompt with the user's buffer.
    process.stdout.write("\r\x1b[K");
    process.stdout.write(block);
    if (currentLine === "") {
      activeInterface.prompt(true);
    } else {
      process.stdout.write("io> " + currentLine);
    }
  } catch (err) {
    console.error("[io] printBackgroundNotification failed:", err instanceof Error ? err.message : String(err));
  }
}

function renderActivity(taskIdArg: string | undefined): void {
  const recent = listRecentTasks(20);
  let task = undefined;
  if (!taskIdArg) {
    task = recent[0];
  } else if (/^\d+$/.test(taskIdArg)) {
    task = recent[parseInt(taskIdArg, 10) - 1];
  } else {
    task = getTask(taskIdArg);
  }
  if (!task) {
    console.log("[io] No task found for activity view.");
    return;
  }
  const events = getTaskEvents(task.task_id);
  if (events.length === 0) {
    console.log(`[io] No buffered activity for task ${task.task_id} (${task.status}).`);
    return;
  }
  const activity = summarize(events);
  console.log(`[io] Activity for task ${task.task_id} (${task.agent_slug}, ${task.status}) — ${activity.length} entries${verbose ? " (verbose)" : ""}`);
  for (const e of activity) {
    const ts = new Date(e.ts).toISOString().slice(11, 19);
    console.log(`  ${ts} ${e.icon} ${e.summary}`);
    if (verbose) {
      if (e.detail) {
        for (const line of e.detail.split(/\r?\n/)) console.log(`        ${line}`);
      } else if (e.raw && typeof e.raw === "object") {
        console.log("        " + JSON.stringify(e.raw).slice(0, 400));
      }
    }
  }
}

function renderInbox(): void {
  const entries = listFeedEntries({ type: "deliverable" });
  if (entries.length === 0) {
    console.log("\u2705 Inbox is empty.");
    return;
  }
  console.log(`\u2705 Inbox (${entries.length} ${entries.length === 1 ? "entry" : "entries"})`);
  console.log("\u2500".repeat(60));
  for (const entry of entries) {
    const ts = new Date(entry.created_at).toLocaleString();
    const unreadMarker = entry.read_at === null ? "\u25cf " : "  ";
    console.log(`${unreadMarker}[${entry.id}] ${entry.title} \u2014 ${ts}`);
    const preview = entry.body.length > 200 ? entry.body.slice(0, 200) + "\u2026" : entry.body;
    for (const line of preview.split(/\r?\n/)) {
      console.log(`    ${line}`);
    }
    console.log("");
  }
}

function clearLine(): void {
  process.stdout.write("\r\x1b[K");
}

export async function startTui(): Promise<void> {
  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Keep a module-level reference so printBackgroundNotification can redraw
  // the prompt without disturbing the user's in-progress input.
  activeInterface = rl;

  console.log(WELCOME_BANNER);
  rl.setPrompt("io> ");
  rl.prompt();

  rl.on("line", async (input: string) => {
    const trimmed = input.trim();

    if (!trimmed) {
      rl.prompt();
      return;
    }

    if (trimmed === "/quit") {
      console.log("[io] Goodbye!");
      rl.close();
      process.exit(0);
    }

    if (trimmed === "/status") {
      const unreadCount = countUnreadFeedEntries();
      console.log(`[io] Uptime: ${Math.floor(process.uptime())}s`);
      if (unreadCount > 0) {
        console.log(`[io] \u2705 Unread feed items: ${unreadCount} ${unreadCount === 1 ? "item" : "items"}`);
      }
      rl.prompt();
      return;
    }

    if (trimmed === "/verbose") {
      verbose = !verbose;
      console.log(`[io] Verbose mode ${verbose ? "ON" : "OFF"}`);
      rl.prompt();
      return;
    }

    if (trimmed === "/activity" || trimmed.startsWith("/activity ")) {
      const arg = trimmed.slice("/activity".length).trim() || undefined;
      try { renderActivity(arg); } catch (err) {
        console.error(`[io] /activity failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      rl.prompt();
      return;
    }

    if (trimmed === "/inbox" || trimmed.startsWith("/inbox ")) {
      const sub = trimmed.slice("/inbox".length).trim();
      try {
        if (sub === "" ) {
          renderInbox();
        } else if (sub === "clear") {
          const entries = listFeedEntries({ type: "deliverable" });
          let deleted = 0;
          for (const entry of entries) {
            if (deleteFeedEntry(entry.id)) deleted++;
          }
          console.log(`[io] Cleared ${deleted} inbox ${deleted === 1 ? "entry" : "entries"}.`);
        } else if (sub.startsWith("delete ")) {
          const rawId = sub.slice("delete ".length).trim();
          const id = Number.parseInt(rawId, 10);
          if (Number.isNaN(id)) {
            console.log(`[io] Invalid ID: "${rawId}". Usage: /inbox delete <id>`);
          } else if (deleteFeedEntry(id)) {
            console.log(`[io] Deleted feed entry #${id}.`);
          } else {
            console.log(`[io] Feed entry #${id} not found.`);
          }
        } else {
          console.log(`[io] Unknown inbox subcommand: "${sub}". Try /inbox, /inbox delete <id>, or /inbox clear.`);
        }
      } catch (err) {
        console.error(`[io] /inbox failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      rl.prompt();
      return;
    }

    if (!messageHandler) {
      console.log("[io] No message handler registered.");
      rl.prompt();
      return;
    }

    // Show typing indicator
    process.stdout.write("...");

    let accumulated = "";
    let firstChunk = true;

    try {
      await messageHandler(trimmed, (text: string, done: boolean) => {
        if (firstChunk) {
          clearLine();
          firstChunk = false;
        }

        if (done) {
          // Finalize the current message as its own line, then reset state
          // so the next message in a multi-turn response starts a fresh bubble.
          clearLine();
          if (accumulated) {
            process.stdout.write(accumulated + "\n");
          }
          accumulated = "";
          firstChunk = true;
        } else {
          accumulated += text;
          clearLine();
          process.stdout.write(accumulated);
        }
      });
      // Restore the prompt once the handler promise fully resolves (i.e. after
      // all turns are done), rather than inside the done callback so that
      // multi-turn responses don't render a premature prompt between messages.
      rl.prompt();
    } catch (err) {
      clearLine();
      console.error(
        `[io] Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      rl.prompt();
    }
  });

  rl.on("close", () => {
    console.log("\n[io] Goodbye!");
    process.exit(0);
  });
}
