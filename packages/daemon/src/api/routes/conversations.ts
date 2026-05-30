import { Router } from 'express';
import { getDatabase } from '../../store/db.js';

export function conversationsRouter(): Router {
	const router = Router();

	/**
	 * GET /api/conversations
	 * Load chat history with cursor-based pagination.
	 * Query params: limit (default 50), before (message id for pagination)
	 */
	router.get('/conversations', async (req, res) => {
		try {
			const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 50, 200);
			const before = req.query.before as string | undefined;

			const db = getDatabase();

			let rows: Array<{
				id: string;
				role: string;
				content: string;
				source: string | null;
				attachments: string | null;
				created_at: string;
			}>;

			if (before) {
				// Get the timestamp of the cursor message
				const cursorResult = await db.execute({
					sql: 'SELECT created_at FROM conversations WHERE id = ?',
					args: [before],
				});

				if (cursorResult.rows.length === 0) {
					res.status(400).json({ error: 'Invalid cursor: message not found' });
					return;
				}

				const cursorTime = cursorResult.rows[0].created_at as string;

				const result = await db.execute({
					sql: `SELECT id, role, content, source, attachments, created_at
						FROM conversations
						WHERE created_at < ? OR (created_at = ? AND id < ?)
						ORDER BY created_at DESC, id DESC
						LIMIT ?`,
					args: [cursorTime, cursorTime, before, limit],
				});

				rows = result.rows as any;
			} else {
				const result = await db.execute({
					sql: `SELECT id, role, content, source, attachments, created_at
						FROM conversations
						ORDER BY created_at DESC, id DESC
						LIMIT ?`,
					args: [limit],
				});

				rows = result.rows as any;
			}

			// Reverse so messages are in chronological order
			const messages = rows.reverse().map((row) => ({
				id: row.id,
				role: row.role,
				content: row.content,
				source: row.source,
				attachments: row.attachments ? JSON.parse(row.attachments) : null,
				timestamp: row.created_at,
			}));

			const cursor = rows.length > 0 ? rows[0].id : null;

			res.json({
				messages,
				cursor,
				hasMore: rows.length === limit,
			});
		} catch (err) {
			res.status(500).json({ error: 'Failed to load conversations' });
		}
	});

	return router;
}
