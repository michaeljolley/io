/**
 * Tests for src/store/feed.ts — unified feed store.
 *
 * DB isolation: setDbPathForTests() redirects the SQLite singleton to a
 * fresh tmp file so these tests never touch ~/.io/io.db.
 */
import { before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setDbPathForTests, closeDb, getDb } from "./db.js";
import {
  createFeedEntry,
  listFeedEntries,
  countUnreadFeedEntries,
  markFeedEntryRead,
  markAllFeedEntriesRead,
  deleteFeedEntry,
  pruneOldFeedEntries,
} from "./feed.js";

// ── DB isolation ─────────────────────────────────────────────────────────────

let tmpDir: string;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "io-feed-test-"));
  setDbPathForTests(join(tmpDir, "io.db"));
});

after(() => {
  closeDb();
  rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  getDb().prepare("DELETE FROM unified_feed").run();
});

// ── createFeedEntry ───────────────────────────────────────────────────────────

describe("createFeedEntry", () => {
  it("creates a deliverable entry with correct fields", () => {
    const entry = createFeedEntry({ type: "deliverable", title: "Task done", body: "Here are the results." });
    assert.equal(entry.type, "deliverable");
    assert.equal(entry.title, "Task done");
    assert.equal(entry.body, "Here are the results.");
    assert.equal(entry.read_at, null);
    assert.equal(entry.source_type, null);
    assert.equal(entry.source_ref, null);
    assert.ok(entry.id > 0);
    assert.ok(entry.created_at);
  });

  it("creates a notification entry with correct fields", () => {
    const entry = createFeedEntry({ type: "notification", title: "Schedule ran", body: "Background task complete." });
    assert.equal(entry.type, "notification");
    assert.equal(entry.read_at, null);
  });

  it("stores source_type and source_ref when provided", () => {
    const entry = createFeedEntry({
      type: "notification",
      title: "Sched",
      body: "Done",
      source_type: "io-schedule",
      source_ref: JSON.stringify({ id: 42 }),
    });
    assert.equal(entry.source_type, "io-schedule");
    assert.equal(entry.source_ref, JSON.stringify({ id: 42 }));
  });

  it("autoincrements ids", () => {
    const a = createFeedEntry({ type: "deliverable", title: "A", body: "a" });
    const b = createFeedEntry({ type: "notification", title: "B", body: "b" });
    assert.ok(b.id > a.id);
  });
});

// ── listFeedEntries ───────────────────────────────────────────────────────────

describe("listFeedEntries", () => {
  it("returns all entries newest first", () => {
    createFeedEntry({ type: "deliverable", title: "First", body: "x" });
    createFeedEntry({ type: "notification", title: "Second", body: "y" });
    const entries = listFeedEntries();
    assert.equal(entries.length, 2);
    assert.equal(entries[0].title, "Second");
    assert.equal(entries[1].title, "First");
  });

  it("filters by type=deliverable", () => {
    createFeedEntry({ type: "deliverable", title: "D", body: "d" });
    createFeedEntry({ type: "notification", title: "N", body: "n" });
    const entries = listFeedEntries({ type: "deliverable" });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, "deliverable");
  });

  it("filters by type=notification", () => {
    createFeedEntry({ type: "deliverable", title: "D", body: "d" });
    createFeedEntry({ type: "notification", title: "N", body: "n" });
    const entries = listFeedEntries({ type: "notification" });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, "notification");
  });

  it("filters by unreadOnly=true", () => {
    const e = createFeedEntry({ type: "notification", title: "Read me", body: "u" });
    createFeedEntry({ type: "notification", title: "Still unread", body: "v" });
    markFeedEntryRead(e.id);
    const entries = listFeedEntries({ unreadOnly: true });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, "Still unread");
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) {
      createFeedEntry({ type: "notification", title: `N${i}`, body: "x" });
    }
    const entries = listFeedEntries({ limit: 3 });
    assert.equal(entries.length, 3);
  });

  it("returns empty array on clean DB", () => {
    assert.deepEqual(listFeedEntries(), []);
  });
});

// ── countUnreadFeedEntries ────────────────────────────────────────────────────

describe("countUnreadFeedEntries", () => {
  it("returns 0 on clean DB", () => {
    assert.equal(countUnreadFeedEntries(), 0);
  });

  it("increments on insert", () => {
    createFeedEntry({ type: "deliverable", title: "T", body: "b" });
    assert.equal(countUnreadFeedEntries(), 1);
    createFeedEntry({ type: "notification", title: "N", body: "b" });
    assert.equal(countUnreadFeedEntries(), 2);
  });

  it("decreases when marked read", () => {
    const e = createFeedEntry({ type: "deliverable", title: "T", body: "b" });
    markFeedEntryRead(e.id);
    assert.equal(countUnreadFeedEntries(), 0);
  });

  it("filters by type", () => {
    createFeedEntry({ type: "deliverable", title: "D", body: "d" });
    createFeedEntry({ type: "notification", title: "N", body: "n" });
    assert.equal(countUnreadFeedEntries("deliverable"), 1);
    assert.equal(countUnreadFeedEntries("notification"), 1);
  });
});

// ── markFeedEntryRead ─────────────────────────────────────────────────────────

describe("markFeedEntryRead", () => {
  it("returns false for a non-existent id", () => {
    assert.equal(markFeedEntryRead(9999), false);
  });

  it("returns true and sets read_at for an unread entry", () => {
    const e = createFeedEntry({ type: "notification", title: "T", body: "b" });
    const result = markFeedEntryRead(e.id);
    assert.equal(result, true);
    const all = listFeedEntries();
    const updated = all.find((x) => x.id === e.id)!;
    assert.ok(updated.read_at !== null);
  });

  it("is idempotent — returns true if already read", () => {
    const e = createFeedEntry({ type: "notification", title: "T", body: "b" });
    markFeedEntryRead(e.id);
    assert.equal(markFeedEntryRead(e.id), true);
  });
});

// ── markAllFeedEntriesRead ────────────────────────────────────────────────────

describe("markAllFeedEntriesRead", () => {
  it("returns count of newly-marked rows", () => {
    createFeedEntry({ type: "notification", title: "A", body: "a" });
    createFeedEntry({ type: "notification", title: "B", body: "b" });
    const count = markAllFeedEntriesRead();
    assert.equal(count, 2);
  });

  it("subsequent call returns 0 (all already read)", () => {
    createFeedEntry({ type: "notification", title: "A", body: "a" });
    markAllFeedEntriesRead();
    assert.equal(markAllFeedEntriesRead(), 0);
  });

  it("respects type filter — only marks matching type", () => {
    createFeedEntry({ type: "deliverable", title: "D", body: "d" });
    createFeedEntry({ type: "notification", title: "N", body: "n" });
    const count = markAllFeedEntriesRead("notification");
    assert.equal(count, 1);
    assert.equal(countUnreadFeedEntries("deliverable"), 1);
    assert.equal(countUnreadFeedEntries("notification"), 0);
  });
});

// ── deleteFeedEntry ───────────────────────────────────────────────────────────

describe("deleteFeedEntry", () => {
  it("returns false for a non-existent id", () => {
    assert.equal(deleteFeedEntry(9999), false);
  });

  it("returns true and removes the entry", () => {
    const e = createFeedEntry({ type: "deliverable", title: "T", body: "b" });
    assert.equal(deleteFeedEntry(e.id), true);
    const entries = listFeedEntries();
    assert.equal(entries.find((x) => x.id === e.id), undefined);
  });

  it("second delete returns false (not idempotent)", () => {
    const e = createFeedEntry({ type: "deliverable", title: "T", body: "b" });
    deleteFeedEntry(e.id);
    assert.equal(deleteFeedEntry(e.id), false);
  });
});

// ── pruneOldFeedEntries ───────────────────────────────────────────────────────

describe("pruneOldFeedEntries", () => {
  it("returns 0 when nothing is old enough to prune", () => {
    createFeedEntry({ type: "notification", title: "Fresh", body: "b" });
    assert.equal(pruneOldFeedEntries(30), 0);
  });

  it("deletes rows older than threshold and returns count", () => {
    getDb()
      .prepare(
        "INSERT INTO unified_feed (type, title, body, created_at) VALUES ('notification', 'Old', 'x', datetime('now', '-31 days'))",
      )
      .run();
    createFeedEntry({ type: "notification", title: "Fresh", body: "y" });
    const pruned = pruneOldFeedEntries(30);
    assert.equal(pruned, 1);
    const remaining = listFeedEntries();
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].title, "Fresh");
  });

  it("is safe on an empty table", () => {
    assert.equal(pruneOldFeedEntries(30), 0);
  });
});
