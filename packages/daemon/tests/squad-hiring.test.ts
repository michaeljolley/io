import { EVENT_NAMES } from "@io/shared";

import { eventBus } from "../src/event-bus.js";
import { activateSquad, deactivateSquad, isSquadAvailable } from "../src/squad/manager.js";
import {
	QA_PROMPT,
	ROLE_GENERATION_PROMPT,
	TEAM_LEAD_PROMPT,
	generateRolePrompt,
} from "../src/squad/roles.js";
import { createSquad } from "../src/store/index.js";
import { cleanupGlobalStoreTestContext, createGlobalStoreTestContext } from "./helpers.js";

async function loadModelSelector() {
	vi.resetModules();
	vi.doMock("@io/shared", () => ({
		FAST_MODEL: "fast-model",
		STANDARD_MODEL: "standard-model",
		PREMIUM_MODEL: "premium-model",
	}));
	return import("../src/squad/model-selector.js");
}

describe("squad model selector", () => {
	afterEach(() => {
		vi.doUnmock("@io/shared");
		vi.resetModules();
	});

	it("selects the fast model for simple tasks", async () => {
		const { selectModelForTask } = await loadModelSelector();

		await expect(selectModelForTask("fix a typo in the readme")).resolves.toBe("fast-model");
	});

	it("selects the standard model for regular tasks", async () => {
		const { selectModelForTask } = await loadModelSelector();

		await expect(selectModelForTask("explain how promises work")).resolves.toBe("standard-model");
	});

	it("selects the premium model for complex tasks", async () => {
		const { selectModelForTask } = await loadModelSelector();

		await expect(
			selectModelForTask("design a multi-file architecture migration plan"),
		).resolves.toBe("premium-model");
	});

	it("falls back to the best available model when the preferred model is unavailable", async () => {
		const { selectModelForTask } = await loadModelSelector();

		await expect(
			selectModelForTask("fix a typo in the readme", ["standard-model", "premium-model"]),
		).resolves.toBe("standard-model");
	});
});

describe("squad role prompts", () => {
	it("provides non-empty templates", () => {
		expect(TEAM_LEAD_PROMPT.trim().length).toBeGreaterThan(100);
		expect(QA_PROMPT.trim().length).toBeGreaterThan(100);
		expect(ROLE_GENERATION_PROMPT.trim().length).toBeGreaterThan(100);
	});

	it("generates role prompts with the role name and repository context", () => {
		const prompt = generateRolePrompt("backend-engineer", "Repo: io\nLanguage: TypeScript");

		expect(prompt).toContain("backend-engineer");
		expect(prompt).toContain("Repo: io");
		expect(prompt).toContain("Language: TypeScript");
	});
});

describe("squad manager", () => {
	let context: Awaited<ReturnType<typeof createGlobalStoreTestContext>> | null = null;

	beforeEach(async () => {
		context = await createGlobalStoreTestContext();
	});

	afterEach(async () => {
		await cleanupGlobalStoreTestContext(context);
		context = null;
	});

	it("activates and deactivates squads and emits updates", async () => {
		const squad = await createSquad(
			{
				name: "Manager Test Squad",
				repoUrl: "https://github.com/octo/manager-test",
				repoOwner: "octo",
				repoName: "manager-test",
				status: "active",
				config: {
					prMode: "draft-pr",
					mcpServers: ["filesystem"],
					maxRevisions: 3,
				},
			},
			context?.db,
		);
		const updates: string[] = [];
		const handler = ({ squad: updatedSquad }: { squad: { status: string } }) => {
			updates.push(updatedSquad.status);
		};
		eventBus.on(EVENT_NAMES.SQUAD_UPDATED, handler);

		try {
			const deactivated = await deactivateSquad(squad.id);
			expect(deactivated.status).toBe("inactive");
			expect(await isSquadAvailable(squad.id)).toBe(false);

			const activated = await activateSquad(squad.id);
			expect(activated.status).toBe("active");
			expect(await isSquadAvailable(squad.id)).toBe(true);
			expect(updates).toEqual(["inactive", "active"]);
		} finally {
			eventBus.off(EVENT_NAMES.SQUAD_UPDATED, handler);
		}
	});

	it("returns false for missing squads and rejects invalid updates", async () => {
		expect(await isSquadAvailable("missing-squad")).toBe(false);
		await expect(activateSquad("missing-squad")).rejects.toThrow("Unable to activate squad");
		await expect(deactivateSquad("missing-squad")).rejects.toThrow("Unable to deactivate squad");
	});
});
