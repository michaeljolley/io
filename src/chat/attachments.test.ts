import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ATTACHMENT_BYTES,
  buildAttachmentSummary,
  toCopilotBlobAttachments,
  validateMessageAttachments,
} from "./attachments.js";

test("validateMessageAttachments accepts valid payload", () => {
  const result = validateMessageAttachments([
    {
      name: "cat.png",
      mimeType: "image/png",
      size: 12,
      content: "aGVsbG8gd29ybGQ=",
    },
  ]);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.attachments.length, 1);
    assert.equal(result.attachments[0].name, "cat.png");
  }
});

test("validateMessageAttachments enforces per-file size limit", () => {
  const result = validateMessageAttachments([
    {
      name: "big.bin",
      mimeType: "application/octet-stream",
      size: MAX_ATTACHMENT_BYTES + 1,
      content: "aGVsbG8gd29ybGQ=",
    },
  ]);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /10MB/);
  }
});

test("validateMessageAttachments enforces total size limit", () => {
  const nineMb = 9 * 1024 * 1024;
  const result = validateMessageAttachments([
    {
      name: "a.bin",
      mimeType: "application/octet-stream",
      size: nineMb,
      content: "aGVsbG8gd29ybGQ=",
    },
    {
      name: "b.bin",
      mimeType: "application/octet-stream",
      size: nineMb,
      content: "aGVsbG8gd29ybGQ=",
    },
    {
      name: "c.bin",
      mimeType: "application/octet-stream",
      size: nineMb,
      content: "aGVsbG8gd29ybGQ=",
    },
  ]);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /25MB/);
  }
});

test("toCopilotBlobAttachments maps attachment content", () => {
  const attachments = toCopilotBlobAttachments([
    {
      name: "cat.png",
      mimeType: "image/png",
      size: 7,
      content: "Zm9vYmFy",
    },
  ]);

  assert.deepEqual(attachments, [
    {
      type: "blob",
      data: "Zm9vYmFy",
      mimeType: "image/png",
      displayName: "cat.png",
    },
  ]);
});

test("buildAttachmentSummary includes attachment metadata", () => {
  const summary = buildAttachmentSummary([
    {
      name: "diagram.png",
      mimeType: "image/png",
      size: 2048,
      content: "Zm9vYmFy",
    },
  ]);

  assert.match(summary, /diagram\.png/);
  assert.match(summary, /image\/png/);
});
