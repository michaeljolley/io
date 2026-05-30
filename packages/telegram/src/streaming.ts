import type { Api } from 'grammy';

/**
 * Manages progressive editing of a Telegram message as streaming tokens arrive.
 * Rate-limits edits to avoid Telegram API throttling (max ~30 edits/sec per chat).
 */
export interface StreamingEditor {
	update(accumulated: string): void;
	finish(finalContent: string): void;
}

const EDIT_INTERVAL_MS = 1000;
const MIN_CONTENT_CHANGE = 20;

export function createStreamingEditor(
	api: Api,
	chatId: number,
	messageId: number,
): StreamingEditor {
	let lastEditedContent = '';
	let lastEditTime = 0;
	let pendingContent: string | null = null;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let finished = false;

	async function doEdit(content: string) {
		if (content === lastEditedContent) return;
		try {
			await api.editMessageText(chatId, messageId, content, {
				parse_mode: 'Markdown',
			});
			lastEditedContent = content;
			lastEditTime = Date.now();
		} catch {
			// Telegram may reject edits if content hasn't changed enough or rate limited
			// Try without markdown on parse failure
			try {
				await api.editMessageText(chatId, messageId, content);
				lastEditedContent = content;
				lastEditTime = Date.now();
			} catch {
				// give up on this edit
			}
		}
	}

	function scheduleEdit(content: string) {
		pendingContent = content;
		if (timer) return;

		const elapsed = Date.now() - lastEditTime;
		const delay = Math.max(0, EDIT_INTERVAL_MS - elapsed);

		timer = setTimeout(() => {
			timer = null;
			if (pendingContent && !finished) {
				doEdit(pendingContent);
				pendingContent = null;
			}
		}, delay);
	}

	return {
		update(accumulated: string) {
			if (finished) return;
			// Only schedule edit if content changed meaningfully
			if (accumulated.length - lastEditedContent.length >= MIN_CONTENT_CHANGE) {
				scheduleEdit(accumulated);
			}
		},

		finish(finalContent: string) {
			finished = true;
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
			// Always do a final edit with the complete content
			doEdit(finalContent);
		},
	};
}
