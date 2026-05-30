import { Router } from 'express';
import { listWikiPages, readWikiPage, searchWiki, writeWikiPage } from '../../wiki/index.js';

export const wikiRouter = Router();

// List pages in a scope
wikiRouter.get('/:scope', (req, res) => {
	const { scope } = req.params;
	const pages = listWikiPages(scope);
	res.json({ scope, pages });
});

// Read a specific page
wikiRouter.get('/:scope/:page', (req, res) => {
	const { scope, page } = req.params;
	const result = readWikiPage(scope, page);
	if (!result) {
		res.status(404).json({ error: `Page '${page}' not found in '${scope}' wiki` });
		return;
	}
	res.json(result);
});

// Write (create/overwrite) a page
wikiRouter.put('/:scope/:page', (req, res) => {
	const { scope, page } = req.params;
	const { content } = req.body;
	if (!content || typeof content !== 'string') {
		res.status(400).json({ error: 'Body must include "content" (string)' });
		return;
	}
	const result = writeWikiPage(scope, page, content);
	res.json(result);
});

// Search across scopes
wikiRouter.get('/', (req, res) => {
	const keyword = req.query.q as string;
	const scopesParam = req.query.scopes as string | undefined;

	if (!keyword) {
		res.status(400).json({ error: 'Query parameter "q" is required' });
		return;
	}

	const scopes = scopesParam ? scopesParam.split(',') : ['io', 'shared'];
	const results = searchWiki(keyword, scopes);
	res.json({ keyword, results });
});
