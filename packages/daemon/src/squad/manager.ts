import type { Objective, Squad, SquadConfig, SquadMember } from "@io/shared";
import { EVENT_NAMES } from "@io/shared";

import { eventBus } from "../event-bus.js";
import { getActiveObjectives, getSquad, updateSquad } from "../store/index.js";

export interface SquadStatusSummary {
	squad: Squad;
	members: SquadMember[];
	activeObjectivesCount: number;
	activeObjectives: Objective[];
}

async function requireSquadRecord(squadId: string) {
	const squad = await getSquad(squadId);
	if (!squad) {
		throw new Error(`Squad ${squadId} was not found`);
	}

	return squad;
}

export async function activateSquad(squadId: string): Promise<Squad> {
	const squad = await updateSquad(squadId, { status: "active" });
	if (!squad) {
		throw new Error(`Unable to activate squad ${squadId}`);
	}

	eventBus.emit(EVENT_NAMES.SQUAD_UPDATED, { squad });
	return squad;
}

export async function deactivateSquad(squadId: string): Promise<Squad> {
	const squad = await updateSquad(squadId, { status: "inactive" });
	if (!squad) {
		throw new Error(`Unable to deactivate squad ${squadId}`);
	}

	eventBus.emit(EVENT_NAMES.SQUAD_UPDATED, { squad });
	return squad;
}

export async function getSquadStatus(squadId: string): Promise<SquadStatusSummary> {
	const squad = await requireSquadRecord(squadId);
	const activeObjectives = await getActiveObjectives(squadId);

	return {
		squad,
		members: squad.members,
		activeObjectivesCount: activeObjectives.length,
		activeObjectives,
	};
}

export async function updateSquadConfig(
	squadId: string,
	config: Partial<SquadConfig>,
): Promise<Squad> {
	const squadRecord = await requireSquadRecord(squadId);
	const mergedConfig: SquadConfig = {
		...squadRecord.config,
		...config,
		mcpServers: config.mcpServers ?? squadRecord.config.mcpServers,
	};

	const updated = await updateSquad(squadId, { config: mergedConfig });
	if (!updated) {
		throw new Error(`Unable to update config for squad ${squadId}`);
	}

	eventBus.emit(EVENT_NAMES.SQUAD_UPDATED, { squad: updated });
	return updated;
}

export async function isSquadAvailable(squadId: string): Promise<boolean> {
	const squad = await getSquad(squadId);
	if (!squad) {
		return false;
	}

	return squad.status === "active";
}
