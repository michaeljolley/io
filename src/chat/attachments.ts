export interface MessageAttachment {
  name: string;
  mimeType: string;
  size: number;
  content: string;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

function isValidBase64(value: string): boolean {
  if (!value || value.length % 4 !== 0) return false;
  return BASE64_RE.test(value);
}

function isMessageAttachment(value: unknown): value is MessageAttachment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<MessageAttachment>;
  return (
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.mimeType === "string" &&
    candidate.mimeType.trim().length > 0 &&
    typeof candidate.size === "number" &&
    Number.isFinite(candidate.size) &&
    candidate.size >= 0 &&
    typeof candidate.content === "string"
  );
}

export function validateMessageAttachments(
  input: unknown
): { ok: true; attachments: MessageAttachment[] } | { ok: false; error: string } {
  if (input === undefined || input === null) {
    return { ok: true, attachments: [] };
  }
  if (!Array.isArray(input)) {
    return { ok: false, error: "attachments must be an array" };
  }

  let totalSize = 0;
  const attachments: MessageAttachment[] = [];
  for (const raw of input) {
    if (!isMessageAttachment(raw)) {
      return {
        ok: false,
        error: "each attachment must include name, mimeType, size, and content",
      };
    }

    if (raw.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: "each attachment must be 10MB or smaller" };
    }

    if (!isValidBase64(raw.content)) {
      return { ok: false, error: `attachment "${raw.name}" has invalid base64 content` };
    }

    const trimmedName = raw.name.trim();
    const trimmedMimeType = raw.mimeType.trim();
    if (!trimmedName || !trimmedMimeType) {
      return { ok: false, error: "attachment name and mimeType are required" };
    }

    totalSize += raw.size;
    attachments.push({
      name: trimmedName,
      mimeType: trimmedMimeType,
      size: raw.size,
      content: raw.content,
    });
  }

  if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { ok: false, error: "total attachment size must be 25MB or smaller" };
  }

  return { ok: true, attachments };
}

export function toCopilotBlobAttachments(
  attachments: MessageAttachment[]
): Array<{ type: "blob"; data: string; mimeType: string; displayName?: string }> {
  return attachments.map((attachment) => ({
    type: "blob",
    data: attachment.content,
    mimeType: attachment.mimeType,
    displayName: attachment.name,
  }));
}

export function buildAttachmentSummary(attachments: MessageAttachment[]): string {
  if (attachments.length === 0) return "";
  const lines = attachments.map(
    (attachment) =>
      `- ${attachment.name} (${attachment.mimeType}, ${Math.round(attachment.size / 1024)}KB)`
  );
  return `\n\n[Attachments]\n${lines.join("\n")}`;
}
