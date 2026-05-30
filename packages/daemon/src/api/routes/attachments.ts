import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { getDatabase } from '../../store/db.js';

export function attachmentsRouter(dataDir: string): Router {
	const router = Router();
	const attachmentsDir = join(dataDir, 'attachments');
	mkdirSync(attachmentsDir, { recursive: true });

	// Use memory storage — we'll write to disk ourselves with proper naming
	const upload = multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: 50 * 1024 * 1024 },
	});

	/**
	 * POST /api/attachments
	 * Upload a file attachment. Returns the attachment metadata.
	 */
	router.post('/attachments', upload.single('file'), async (req, res) => {
		try {
			const file = req.file;
			if (!file) {
				res.status(400).json({ error: 'No file uploaded' });
				return;
			}

			const id = crypto.randomUUID();
			const messageId = (req.body?.messageId as string) ?? null;
			const fileDir = join(attachmentsDir, id);
			mkdirSync(fileDir, { recursive: true });
			const diskPath = join(fileDir, file.originalname);

			await writeFile(diskPath, file.buffer);

			const db = getDatabase();
			await db.execute({
				sql: `INSERT INTO attachments (id, message_id, filename, mime_type, size_bytes, disk_path)
				      VALUES (?, ?, ?, ?, ?, ?)`,
				args: [id, messageId, file.originalname, file.mimetype, file.size, diskPath],
			});

			res.status(201).json({
				id,
				filename: file.originalname,
				mimeType: file.mimetype,
				sizeBytes: file.size,
			});
		} catch (err) {
			res.status(500).json({ error: 'Failed to upload attachment' });
		}
	});

	/**
	 * GET /api/attachments/:id
	 * Download an attachment by ID.
	 */
	router.get('/attachments/:id', async (req, res) => {
		try {
			const db = getDatabase();
			const result = await db.execute({
				sql: 'SELECT filename, mime_type, disk_path FROM attachments WHERE id = ?',
				args: [req.params.id],
			});

			if (result.rows.length === 0) {
				res.status(404).json({ error: 'Attachment not found' });
				return;
			}

			const row = result.rows[0];
			const diskPath = row.disk_path as string;
			const filename = row.filename as string;
			const mimeType = (row.mime_type as string) ?? 'application/octet-stream';

			if (!existsSync(diskPath)) {
				res.status(404).json({ error: 'Attachment file missing from disk' });
				return;
			}

			res.setHeader('Content-Type', mimeType);
			res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
			createReadStream(diskPath).pipe(res);
		} catch (err) {
			res.status(500).json({ error: 'Failed to retrieve attachment' });
		}
	});

	return router;
}
