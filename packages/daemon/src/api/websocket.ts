import type { Server as HttpServer } from "node:http";

import { EVENT_NAMES, type EventName, type EventPayloads, type WsClientMessage } from "@io/shared";
import { WebSocket, WebSocketServer } from "ws";

import { eventBus as defaultEventBus } from "../event-bus.js";

interface ManagedClient {
	socket: WebSocket;
	channels: Set<string>;
}

const managedClients = new Set<ManagedClient>();
let websocketServer: WebSocketServer | null = null;
let forwardingRegistered = false;

export function initWebSocket(server: HttpServer, eventBus = defaultEventBus): WebSocketServer {
	if (websocketServer !== null) {
		return websocketServer;
	}

	websocketServer = new WebSocketServer({ server });
	websocketServer.on("connection", (socket) => {
		const client: ManagedClient = {
			socket,
			channels: new Set<string>(),
		};
		managedClients.add(client);
		send(socket, "connected", { channels: [] });

		socket.on("message", (rawMessage) => {
			handleClientMessage(client, rawMessage.toString());
		});

		socket.on("close", () => {
			managedClients.delete(client);
		});

		socket.on("error", () => {
			managedClients.delete(client);
		});
	});

	registerEventForwarding(eventBus);
	return websocketServer;
}

export function broadcast(event: string, payload: unknown): void {
	for (const client of managedClients) {
		send(client.socket, event, payload);
	}
}

export function broadcastToChannel(channel: string, event: string, payload: unknown): void {
	for (const client of managedClients) {
		if (client.channels.has(channel)) {
			send(client.socket, event, payload, channel);
		}
	}
}

function registerEventForwarding(eventBus = defaultEventBus): void {
	if (forwardingRegistered) {
		return;
	}

	forwardingRegistered = true;
	const eventNames = Object.values(EVENT_NAMES) as EventName[];

	for (const eventName of eventNames) {
		eventBus.on(eventName, (payload) => {
			forwardEvent(eventName, payload as EventPayloads[EventName]);
		});
	}
}

function forwardEvent(event: EventName, payload: EventPayloads[EventName]): void {
	const channels = deriveChannels(event, payload);

	if (channels.size === 0) {
		broadcast(event, payload);
		return;
	}

	for (const channel of channels) {
		broadcastToChannel(channel, event, payload);
	}
}

function deriveChannels(event: EventName, payload: EventPayloads[EventName]): Set<string> {
	const channels = new Set<string>();
	const payloadRecord = payload as Record<string, unknown>;

	if (event.startsWith("chat.")) {
		channels.add("chat");
	}

	if (event.startsWith("inbox.") || event === EVENT_NAMES.NOTIFICATION) {
		channels.add("inbox");
	}

	if (
		event.startsWith("squad.") ||
		event.startsWith("objective.") ||
		event.startsWith("task.") ||
		event.startsWith("agent.") ||
		event.startsWith("review.") ||
		event.startsWith("qa.") ||
		event.startsWith("pr.")
	) {
		channels.add("activity");
	}

	collectSquadChannels(payloadRecord, channels);

	const notificationChannel = payloadRecord.channel;
	if (typeof notificationChannel === "string" && notificationChannel.length > 0) {
		channels.add(notificationChannel);
	}

	return channels;
}

function collectSquadChannels(payload: Record<string, unknown>, channels: Set<string>): void {
	for (const candidate of [
		payload.squadId,
		(payload.squad as Record<string, unknown> | undefined)?.id,
		(payload.objective as Record<string, unknown> | undefined)?.squadId,
	]) {
		if (typeof candidate === "string" && candidate.length > 0) {
			channels.add(candidate);
		}
	}
}

function handleClientMessage(client: ManagedClient, rawMessage: string): void {
	try {
		const message = JSON.parse(rawMessage) as WsClientMessage;

		if (message.type === "subscribe") {
			for (const channel of normalizeChannels(message.channels)) {
				client.channels.add(channel);
			}
			send(client.socket, "subscribed", { channels: Array.from(client.channels) });
			return;
		}

		if (message.type === "unsubscribe") {
			for (const channel of normalizeChannels(message.channels)) {
				client.channels.delete(channel);
			}
			send(client.socket, "unsubscribed", { channels: Array.from(client.channels) });
			return;
		}

		send(client.socket, "error", { message: `Unsupported message type: ${message.type}` });
	} catch (error) {
		send(client.socket, "error", {
			message: error instanceof Error ? error.message : "Invalid websocket payload",
		});
	}
}

function normalizeChannels(channels: string[]): string[] {
	return channels
		.filter((channel): channel is string => typeof channel === "string")
		.map((channel) => channel.trim())
		.filter((channel) => channel.length > 0);
}

function send(socket: WebSocket, type: string, payload: unknown, channel?: string): void {
	if (socket.readyState !== WebSocket.OPEN) {
		return;
	}

	const message = channel ? { type, channel, payload } : { type, payload };
	socket.send(JSON.stringify(message));
}
