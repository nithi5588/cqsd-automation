import { ExternalApiError } from "@cqsd/shared/http";
import type {
	GraphAttendanceRecord,
	GraphCreateWebinarInput,
	GraphRawAttendanceReport,
	GraphRawCollection,
	GraphRawRegistration,
	GraphRawSession,
	GraphRawWebinar,
	GraphRegistrationInput,
	GraphRegistrationRow,
	GraphWebinarDetails,
	GraphWebinarSession,
} from "./graph.types";
import { GRAPH_BASE_URL } from "./urls";

const PROVIDER = "microsoft_graph";
const WEBINARS_PATH = "/solutions/virtualEvents/webinars";
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;

type GraphTokenKind = "delegated" | "app-only";

export interface GraphClientOptions {
	/** Organizer-user token (VirtualEvent.ReadWrite) — used to create/publish webinars. */
	getDelegatedToken: () => Promise<string>;
	/** Client-credentials token — used for sessions, registrations, and attendance. */
	getAppOnlyToken: () => Promise<string>;
	organizerUpn: string;
	/** Optional forced-refresh variants used once after a 401 before the single retry. */
	getFreshDelegatedToken?: () => Promise<string>;
	getFreshAppOnlyToken?: () => Promise<string>;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response, attempt: number): number {
	const header = response.headers.get("Retry-After");
	if (header) {
		const seconds = Number(header);
		if (Number.isFinite(seconds) && seconds >= 0) {
			return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
		}
		const dateMs = Date.parse(header);
		if (!Number.isNaN(dateMs)) {
			return Math.min(Math.max(dateMs - Date.now(), 0), MAX_RETRY_DELAY_MS);
		}
	}
	return Math.min(500 * 2 ** (attempt - 1), 8_000);
}

async function readJson(response: Response): Promise<unknown> {
	if (response.status === 204) return undefined;
	const text = await response.text();
	if (!text) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function numberOr(value: number | null | undefined, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Thin typed wrapper over Microsoft Graph's virtual-events (webinar) API.
 * Every call: bearer auth (delegated or app-only per endpoint), one forced-refresh
 * retry on 401, up to 3 retries on 429/5xx honoring `Retry-After`, `@odata.nextLink`
 * pagination on collections, and `ExternalApiError("microsoft_graph", …)` otherwise.
 */
export class GraphClient {
	readonly organizerUpn: string;

	constructor(private readonly opts: GraphClientOptions) {
		this.organizerUpn = opts.organizerUpn;
	}

	// ------------------------------------------------------------
	// Webinar lifecycle (delegated)
	// ------------------------------------------------------------

	async createWebinarDraft(input: GraphCreateWebinarInput): Promise<{ webinarId: string }> {
		const body: Record<string, unknown> = {
			displayName: input.title,
			startDateTime: { dateTime: input.startIso, timeZone: input.timeZone },
			endDateTime: { dateTime: input.endIso, timeZone: input.timeZone },
			// Teams keeps sending registration confirmations/reminders to attendees
			// unless the org turns this off (MS_TEAMS_ATTENDEE_EMAILS=false).
			settings: { isAttendeeEmailNotificationEnabled: input.attendeeEmailsEnabled ?? true },
		};
		if (input.description !== undefined) {
			// Graph models description as an itemBody, not a plain string.
			body.description = { content: input.description, contentType: "html" };
		}

		const payload = await this.request<GraphRawWebinar>("delegated", "POST", WEBINARS_PATH, body);
		const webinarId = payload?.id ?? null;
		if (!webinarId) {
			throw new ExternalApiError(PROVIDER, "webinar create response did not include an id", payload);
		}
		return { webinarId };
	}

	async publishWebinar(webinarId: string): Promise<void> {
		await this.request<unknown>("delegated", "POST", `${WEBINARS_PATH}/${webinarId}/publish`);
	}

	// ------------------------------------------------------------
	// Webinar reads + registrations (app-only)
	// ------------------------------------------------------------

	async getSessions(webinarId: string): Promise<GraphWebinarSession[]> {
		const sessions = await this.getAllPages<GraphRawSession>(
			"app-only",
			`${WEBINARS_PATH}/${webinarId}/sessions`,
		);
		return sessions.map((session) => ({
			sessionId: session?.id ?? "",
			joinWebUrl: session?.joinWebUrl ?? null,
		}));
	}

	async getWebinar(webinarId: string): Promise<GraphWebinarDetails> {
		const payload = await this.request<GraphRawWebinar>("app-only", "GET", `${WEBINARS_PATH}/${webinarId}`);
		const registrationWebUrl =
			payload?.registrationConfiguration?.registrationWebUrl ??
			payload?.settings?.registrationConfiguration?.registrationWebUrl ??
			payload?.settings?.registrationWebUrl ??
			payload?.registrationWebUrl ??
			null;
		return { status: payload?.status ?? null, registrationWebUrl };
	}

	async createAnonymousRegistration(
		webinarId: string,
		input: GraphRegistrationInput,
	): Promise<{ registrationId: string; joinUrl: string | null }> {
		const payload = await this.request<GraphRawRegistration>(
			"app-only",
			"POST",
			`${WEBINARS_PATH}/${webinarId}/registrations`,
			{
				firstName: input.firstName,
				lastName: input.lastName,
				email: input.email.toLowerCase(),
			},
		);
		const registrationId = payload?.id ?? null;
		if (!registrationId) {
			throw new ExternalApiError(PROVIDER, "registration create response did not include an id", payload);
		}
		return { registrationId, joinUrl: payload?.joinWebUrl ?? payload?.joinUrl ?? null };
	}

	async listRegistrations(webinarId: string): Promise<GraphRegistrationRow[]> {
		const registrations = await this.getAllPages<GraphRawRegistration>(
			"app-only",
			`${WEBINARS_PATH}/${webinarId}/registrations`,
		);
		return registrations.map((registration) => ({
			registrationId: registration?.id ?? "",
			email: registration?.email ? registration.email.toLowerCase() : null,
			firstName: registration?.firstName ?? null,
			lastName: registration?.lastName ?? null,
			status: registration?.status ?? null,
			registrationDateTime: registration?.registrationDateTime ?? null,
		}));
	}

	/**
	 * Fetches every attendance report for the session, keeps the LATEST one
	 * (by meetingEndDateTime), and flattens its attendance records.
	 */
	async getAttendanceRecords(webinarId: string, sessionId: string): Promise<GraphAttendanceRecord[]> {
		const reports = await this.getAllPages<GraphRawAttendanceReport>(
			"app-only",
			`${WEBINARS_PATH}/${webinarId}/sessions/${sessionId}/attendanceReports?$expand=attendanceRecords`,
		);
		if (reports.length === 0) return [];

		const latest = reports.reduce((best, report) => {
			const bestEnd = Date.parse(best?.meetingEndDateTime ?? "") || 0;
			const reportEnd = Date.parse(report?.meetingEndDateTime ?? "") || 0;
			return reportEnd >= bestEnd ? report : best;
		});

		const records: GraphAttendanceRecord[] = [];
		for (const record of latest?.attendanceRecords ?? []) {
			if (!record) continue;
			const email = record.emailAddress ? record.emailAddress.toLowerCase() : null;
			const intervals = (record.attendanceIntervals ?? []).filter((interval) => interval != null);
			records.push({
				recordId: record.id ?? email ?? "",
				email,
				displayName: record.identity?.displayName ?? null,
				totalAttendanceInSeconds: numberOr(record.totalAttendanceInSeconds, 0),
				joinDateTime: intervals[0]?.joinDateTime ?? null,
				leaveDateTime: intervals[intervals.length - 1]?.leaveDateTime ?? null,
			});
		}
		return records;
	}

	// ------------------------------------------------------------
	// Internals
	// ------------------------------------------------------------

	private async getAllPages<T>(kind: GraphTokenKind, path: string): Promise<T[]> {
		const items: T[] = [];
		let next: string | null = path;
		while (next) {
			const payload: GraphRawCollection<T> | undefined = await this.request<GraphRawCollection<T>>(
				kind,
				"GET",
				next,
			);
			for (const item of payload?.value ?? []) {
				if (item != null) items.push(item);
			}
			next = payload?.["@odata.nextLink"] ?? null;
		}
		return items;
	}

	private getToken(kind: GraphTokenKind, fresh: boolean): Promise<string> {
		if (kind === "delegated") {
			return fresh
				? (this.opts.getFreshDelegatedToken ?? this.opts.getDelegatedToken)()
				: this.opts.getDelegatedToken();
		}
		return fresh
			? (this.opts.getFreshAppOnlyToken ?? this.opts.getAppOnlyToken)()
			: this.opts.getAppOnlyToken();
	}

	/** `@odata.nextLink` is absolute — use it verbatim; everything else resolves against GRAPH_BASE_URL. */
	private resolveUrl(pathOrUrl: string): string {
		if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
		return `${GRAPH_BASE_URL}${pathOrUrl}`;
	}

	private async request<T>(
		kind: GraphTokenKind,
		method: string,
		pathOrUrl: string,
		body?: unknown,
	): Promise<T> {
		const url = this.resolveUrl(pathOrUrl);
		let token = await this.getToken(kind, false);
		let retriedAuth = false;
		let retries = 0;

		for (;;) {
			let response: Response;
			try {
				response = await fetch(url, {
					method,
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: body === undefined ? undefined : JSON.stringify(body),
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
			} catch (error) {
				throw new ExternalApiError(
					PROVIDER,
					`${method} ${url} network failure: ${error instanceof Error ? error.message : String(error)}`,
				);
			}

			if (response.ok) {
				return (await readJson(response)) as T;
			}

			if (response.status === 401 && !retriedAuth) {
				retriedAuth = true;
				token = await this.getToken(kind, true);
				continue;
			}

			if ((response.status === 429 || response.status >= 500) && retries < MAX_RETRIES) {
				retries += 1;
				await sleep(retryDelayMs(response, retries));
				continue;
			}

			const detail = await response.text().catch(() => "");
			throw new ExternalApiError(PROVIDER, `${method} ${pathOrUrl} failed with ${response.status}`, {
				status: response.status,
				body: detail.slice(0, 2_000),
			});
		}
	}
}
