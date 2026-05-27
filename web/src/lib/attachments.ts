export interface MessageAttachment {
  name: string;
  mimeType: string;
  size: number;
  content: string;
}

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export function formatAttachmentSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageAttachment(attachment: MessageAttachment): boolean {
  return attachment.mimeType.startsWith("image/");
}

export function toDataUrl(attachment: MessageAttachment): string {
  return `data:${attachment.mimeType};base64,${attachment.content}`;
}

export async function fileToMessageAttachment(file: File): Promise<MessageAttachment> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    throw new Error(`Unable to parse file content for ${file.name}`);
  }

  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    content: dataUrl.slice(commaIndex + 1),
  };
}

export function validateAttachmentSizes(
  attachments: MessageAttachment[]
): { ok: true } | { ok: false; error: string } {
  for (const attachment of attachments) {
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
      return {
        ok: false,
        error: `\"${attachment.name}\" exceeds the 10MB per-file limit.`,
      };
    }
  }

  const total = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  if (total > MAX_TOTAL_ATTACHMENT_BYTES) {
    return { ok: false, error: "Attachments exceed the 25MB per-message limit." };
  }

  return { ok: true };
}
