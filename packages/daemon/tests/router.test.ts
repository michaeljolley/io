import { FAST_MODEL, PREMIUM_MODEL, STANDARD_MODEL } from "@io/shared";

import {
	classifyMessage,
	getModelForTier,
	resetRouterState,
	routeMessage,
} from "../src/copilot/router.js";

describe("model router", () => {
	beforeEach(() => {
		resetRouterState();
	});

	it.each([["hi"], ["thanks"], ["what's my name?"], ["status"]])(
		"routes fast tier messages like %s",
		(message) => {
			expect(classifyMessage(message)).toBe("fast");
			expect(routeMessage(message)).toMatchObject({
				requestedTier: "fast",
				effectiveTier: "fast",
				model: FAST_MODEL,
			});
		},
	);

	it.each([
		["explain how promises work"],
		["explain the difference between map and forEach in JavaScript"],
	])("routes standard tier prompts like %s", (message) => {
		expect(classifyMessage(message)).toBe("standard");
		expect(routeMessage(message)).toMatchObject({
			requestedTier: "standard",
			effectiveTier: "standard",
			model: STANDARD_MODEL,
		});
	});

	it.each([
		["design a microservices architecture for an e-commerce app"],
		["refactor the authentication module to use OAuth2"],
	])("routes premium tier prompts like %s", (message) => {
		expect(classifyMessage(message)).toBe("premium");
		expect(routeMessage(message)).toMatchObject({
			requestedTier: "premium",
			effectiveTier: "premium",
			model: PREMIUM_MODEL,
		});
	});

	it("treats empty input as a fast-tier request", () => {
		expect(classifyMessage("   ")).toBe("fast");
		expect(routeMessage("   ").model).toBe(FAST_MODEL);
	});

	it("returns the configured model for each tier", () => {
		expect(getModelForTier("fast")).toBe(FAST_MODEL);
		expect(getModelForTier("standard")).toBe(STANDARD_MODEL);
		expect(getModelForTier("premium")).toBe(PREMIUM_MODEL);
	});

	it("enforces cooldown before switching tiers", () => {
		const initial = routeMessage("design a microservices architecture for an e-commerce app");
		const firstFastAttempt = routeMessage("hi");
		const secondFastAttempt = routeMessage("thanks");
		const thirdFastAttempt = routeMessage("status");
		const switched = routeMessage("what's my name?");

		expect(initial).toMatchObject({
			effectiveTier: "premium",
			switched: true,
			cooldownRemaining: 3,
		});
		expect(firstFastAttempt).toMatchObject({
			requestedTier: "fast",
			effectiveTier: "premium",
			switched: false,
			cooldownRemaining: 2,
		});
		expect(secondFastAttempt.cooldownRemaining).toBe(1);
		expect(thirdFastAttempt.cooldownRemaining).toBe(0);
		expect(switched).toMatchObject({
			requestedTier: "fast",
			effectiveTier: "fast",
			switched: true,
			cooldownRemaining: 3,
		});
	});

	it("does not switch tiers when consecutive messages stay in the same tier", () => {
		routeMessage("explain how promises work");
		const next = routeMessage("explain the difference between map and forEach in JavaScript");

		expect(next).toMatchObject({
			requestedTier: "standard",
			effectiveTier: "standard",
			switched: false,
			cooldownRemaining: 2,
		});
	});
});
