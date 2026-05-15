import { config } from "./config.js";
import { createFeedEntry, type FeedEntry } from "./store/feed.js";

export type NotificationSource =
  | { type: "io-schedule"; scheduleId: number; scheduleName: string }
  | { type: "squad-schedule"; scheduleId: number; squadSlug: string; scheduleName: string }
  | { type: "background"; label?: string };

export interface BackgroundNotificationInput {
  source: NotificationSource;
  title: string;
  text: string;
}

export interface NotifyResult {
  id?: number;
  dispatched: { telegram: boolean; tui: boolean; sse: boolean };
  skipped?: "off" | "not-meaningful" | "empty";
}

const HEARTBEAT_PATTERNS: RegExp[] = [
  /^no active tasks?\.?$/i,
  /^nothing to report\.?$/i,
  /^all clear\.?$/i,
  /^no updates?\.?$/i,
  /^no changes?\.?$/i,
  /^idle\.?$/i,
  /^heartbeat\.?$/i,
  /^ok\.?$/i,
];

export function isMeaningfulOutput(text: string): boolean {
  const trimmed = (text ?? "").trim();
  if (trimmed.length < 20) return false;
  const firstLine =
    trimmed.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  if (HEARTBEAT_PATTERNS.some((re) => re.test(firstLine))) return false;
  return true;
}

type TelegramSender = (opts: { title: string; text: string }) => Promise<void>;
type TuiSender = (opts: { title: string; text: string }) => void;
type SseBroadcaster = (payload: {
  id: number;
  source: { type: string; [k: string]: unknown };
  title: string;
  text: string;
  createdAt: string;
}) => void;

let telegramSender: TelegramSender | undefined;
let tuiSender: TuiSender | undefined;
let sseBroadcaster: SseBroadcaster | undefined;

export function setTelegramSender(fn: TelegramSender | undefined): void {
  telegramSender = fn;
}
export function setTuiSender(fn: TuiSender | undefined): void {
  tuiSender = fn;
}
export function setSseBroadcaster(fn: SseBroadcaster | undefined): void {
  sseBroadcaster = fn;
}

export function _resetNotifySendersForTests(): void {
  telegramSender = undefined;
  tuiSender = undefined;
  sseBroadcaster = undefined;
}

export async function notifyBackground(
  input: BackgroundNotificationInput,
): Promise<NotifyResult> {
  const dispatched = { telegram: false, tui: false, sse: false };
  const text = (input.text ?? "").trim();
  if (text.length === 0) return { dispatched, skipped: "empty" };

  const mode = config.backgroundNotifyMode ?? "meaningful";
  if (mode === "off") return { dispatched, skipped: "off" };
  if (mode === "meaningful" && !isMeaningfulOutput(text)) {
    return { dispatched, skipped: "not-meaningful" };
  }

  const { source, title } = input;
  const sourceRefJson = JSON.stringify(stripType(source));
  let row: FeedEntry;
  try {
    row = createFeedEntry({
      type: "notification",
      title,
      body: text,
      source_type: source.type,
      source_ref: sourceRefJson === "{}" ? null : sourceRefJson,
    });
  } catch (err) {
    console.error("[notify] failed to persist notification:", err);
    return { dispatched };
  }

  if (sseBroadcaster) {
    try {
      sseBroadcaster({
        id: row.id,
        source: { type: source.type, ...stripType(source) },
        title,
        text,
        createdAt: row.created_at,
      });
      dispatched.sse = true;
    } catch (err) {
      console.error("[notify] sse broadcast failed:", err);
    }
  }

  if (tuiSender && (config.backgroundNotifyTui ?? true)) {
    try {
      tuiSender({ title, text });
      dispatched.tui = true;
    } catch (err) {
      console.error("[notify] tui send failed:", err);
    }
  }

  if (telegramSender && (config.backgroundNotifyTelegram ?? true)) {
    try {
      await telegramSender({ title, text });
      dispatched.telegram = true;
    } catch (err) {
      console.error("[notify] telegram send failed:", err);
    }
  }

  return { id: row.id, dispatched };
}

function stripType<T extends { type: string }>(s: T): Omit<T, "type"> {
  const { type: _t, ...rest } = s;
  void _t;
  return rest;
}
