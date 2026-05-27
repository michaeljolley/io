import assert from "node:assert/strict";
import test, { after } from "node:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const testHome = join(process.cwd(), ".local", "conversation-attachments-test-home");
if (existsSync(testHome)) {
  rmSync(testHome, { recursive: true, force: true });
}
mkdirSync(testHome, { recursive: true });
process.env.HOME = testHome;

const { saveMessage, getConversation } = await import("./conversations.js");
const { closeDb } = await import("./db.js");

after(() => {
  closeDb();
  rmSync(testHome, { recursive: true, force: true });
});

test("saveMessage persists attachments", () => {
  const conversationId = "conv-attachments-1";
  saveMessage(conversationId, "user", "Please inspect image", "web", [
    {
      name: "screen.png",
      mimeType: "image/png",
      size: 1024,
      content: "aGVsbG8gd29ybGQ=",
    },
  ]);

  const messages = getConversation(conversationId);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].attachments.length, 1);
  assert.equal(messages[0].attachments[0].name, "screen.png");
  assert.equal(messages[0].attachments[0].mimeType, "image/png");
});
