import { Router } from 'express';
import {
	type InboxKind,
	type InboxStatus,
	getInboxEntry,
	getUnreadCount,
	listInboxEntries,
	markInboxRead,
	resolveInboxEntry,
} from '../../store/inbox.js';

export function inboxRouter(): Router {
	const router = Router();

	/**
	 * GET /api/inbox
	 * List inbox entries with optional filters.
	 * Query params: status, squad, kind, limit
	 */
	router.get('/inbox', async (req, res) => {
		try {
			const entries = await listInboxEntries({
				status: req.query.status as InboxStatus | undefined,
				squadId: req.query.squad as string | undefined,
				kind: req.query.kind as InboxKind | undefined,
				limit: req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined,
			});
			res.json({ entries });
		} catch {
			res.status(500).json({ error: 'Failed to list inbox entries' });
		}
	});

	/**
	 * GET /api/inbox/unread-count
	 * Get the number of unread inbox entries.
	 */
	router.get('/inbox/unread-count', async (_req, res) => {
		try {
			const count = await getUnreadCount();
			res.json({ count });
		} catch {
			res.status(500).json({ error: 'Failed to get unread count' });
		}
	});

	/**
	 * GET /api/inbox/:id
	 * Get a single inbox entry.
	 */
	router.get('/inbox/:id', async (req, res) => {
		try {
			const entry = await getInboxEntry(req.params.id);
			if (!entry) {
				res.status(404).json({ error: 'Entry not found' });
				return;
			}
			res.json({ entry });
		} catch {
			res.status(500).json({ error: 'Failed to get inbox entry' });
		}
	});

	/**
	 * POST /api/inbox/:id/read
	 * Mark an entry as read.
	 */
	router.post('/inbox/:id/read', async (req, res) => {
		try {
			await markInboxRead(req.params.id);
			res.json({ status: 'ok' });
		} catch {
			res.status(500).json({ error: 'Failed to mark entry as read' });
		}
	});

	/**
	 * POST /api/inbox/:id/respond
	 * Respond to an inbox question. Resolves any blocking squad.
	 * Body: { response: string }
	 */
	router.post('/inbox/:id/respond', async (req, res) => {
		try {
			const { response } = req.body as { response?: string };
			if (!response) {
				res.status(400).json({ error: 'response is required' });
				return;
			}

			const unblocked = await resolveInboxEntry(req.params.id, response);
			res.json({ status: 'ok', squadUnblocked: unblocked });
		} catch {
			res.status(500).json({ error: 'Failed to respond to entry' });
		}
	});

	return router;
}
