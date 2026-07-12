import { titleCase } from "./format";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

const MAP: Record<string, Tone> = {
	// oauth connections
	connected: "ok",
	not_connected: "neutral",
	disconnected: "neutral",
	expired: "warn",

	// campaigns
	draft: "neutral",
	scheduled: "info",
	sending: "warn",
	sent: "ok",
	failed: "danger",

	// webinars
	published: "ok",
	canceled: "danger",
	completed: "ok",

	// lead import jobs / generic async jobs
	pending: "warn",
	processing: "info",

	// attendance
	attended: "ok",
	no_show: "danger",
};

export const statusTone = (status: string): Tone => MAP[status.toLowerCase()] ?? "neutral";
export const statusLabel = (status: string): string => titleCase(status.replace(/_/g, " "));
