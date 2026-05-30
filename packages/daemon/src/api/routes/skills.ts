import { Router } from 'express';
import {
	activateSkill,
	deactivateSkill,
	getActiveSkills,
	getSkill,
	installSkill,
	installSkillFromUrl,
	listInstalledSkills,
	removeSkill,
} from '../../skills/index.js';

export const skillsRouter = Router();

// List installed skills
skillsRouter.get('/skills', async (_req, res) => {
	const skills = listInstalledSkills();
	const orchestratorActivations = await getActiveSkills('orchestrator');

	const result = skills.map((s) => ({
		name: s.name,
		activatedForOrchestrator: orchestratorActivations.some((a) => a.skillName === s.name),
		preview: s.content.slice(0, 200),
	}));

	res.json({ skills: result });
});

// Get a specific skill
skillsRouter.get('/skills/:name', (req, res) => {
	const skill = getSkill(req.params.name);
	if (!skill) {
		res.status(404).json({ error: `Skill '${req.params.name}' not found` });
		return;
	}
	res.json(skill);
});

// Install a skill (from URL or content)
skillsRouter.post('/skills/install', async (req, res) => {
	const { name, url, content } = req.body;

	if (!name) {
		res.status(400).json({ error: 'name is required' });
		return;
	}

	try {
		if (url) {
			const skill = await installSkillFromUrl(name, url);
			res.status(201).json({ installed: true, name: skill.name });
		} else if (content) {
			const skill = installSkill(name, content);
			res.status(201).json({ installed: true, name: skill.name });
		} else {
			res.status(400).json({ error: 'Either "url" or "content" is required' });
		}
	} catch (err) {
		res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
	}
});

// Activate a skill
skillsRouter.post('/skills/:name/activate', async (req, res) => {
	const { targetType, targetId } = req.body;
	if (!targetType || !['orchestrator', 'squad'].includes(targetType)) {
		res.status(400).json({ error: 'targetType must be "orchestrator" or "squad"' });
		return;
	}

	const skill = getSkill(req.params.name);
	if (!skill) {
		res.status(404).json({ error: `Skill '${req.params.name}' not found` });
		return;
	}

	await activateSkill(req.params.name, targetType, targetId);
	res.json({ activated: true, skillName: req.params.name, targetType, targetId });
});

// Deactivate a skill
skillsRouter.post('/skills/:name/deactivate', async (req, res) => {
	const { targetType, targetId } = req.body;
	if (!targetType || !['orchestrator', 'squad'].includes(targetType)) {
		res.status(400).json({ error: 'targetType must be "orchestrator" or "squad"' });
		return;
	}

	await deactivateSkill(req.params.name, targetType, targetId);
	res.json({ deactivated: true, skillName: req.params.name });
});

// Remove a skill
skillsRouter.delete('/skills/:name', (req, res) => {
	removeSkill(req.params.name);
	res.status(204).end();
});

// Get activations for a target
skillsRouter.get('/skills-activations', async (req, res) => {
	const targetType = (req.query.targetType as string) ?? 'orchestrator';
	const targetId = req.query.targetId as string | undefined;
	const activations = await getActiveSkills(targetType as 'orchestrator' | 'squad', targetId);
	res.json({ activations });
});
