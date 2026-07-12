import { ExternalApiError } from "@cqsd/shared/http";
import type {
	CcActivityStats,
	CcBounceRow,
	CcBulkImportRow,
	CcCreateEmailCampaignInput,
	CcRawActivityResponse,
	CcRawEmailCampaignResponse,
	CcRawListsPage,
	CcRawSignUpFormResponse,
	CcRawStatsCounts,
	CcRawStatsResponse,
	CcRawTrackingActivity,
	CcRawTrackingPage,
	CcTrackingRow,
	CcUpsertContactInput,
} from "./cc.types";

const PROVIDER = "constant_contact";
const CC_API_HOST = "https://api.cc.email";
const CC_BASE_URL = `${CC_API_HOST}/v3`;
const MAX_RETRIES = 3;
const MAX_RETRY_DELAY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 30_000;
/** CC tracking/list endpoints allow up to 500 rows per page — fewer round-trips while paginating. */
const PAGE_LIMIT = 500;

export interface ConstantContactClientOptions {
	getAccessToken: () => Promise<string>;
	/**
	 * Called once after a 401 to force a token refresh before the single retry.
	 * Falls back to `getAccessToken` when omitted.
	 */
	getFreshAccessToken?: () => Promise<string>;
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

function numberOr(value: number | string | null | undefined, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) return parsed;
	}
	return fallback;
}

/**
 * Thin typed wrapper over the Constant Contact v3 REST API (native fetch).
 * Every call: bearer auth, one forced-refresh retry on 401, up to 3 retries on
 * 429/5xx honoring `Retry-After`, `_links.next.href` pagination on list/tracking
 * endpoints, and `ExternalApiError("constant_contact", …)` on anything unrecoverable.
 */
export class ConstantContactClient {
	constructor(private readonly opts: ConstantContactClientOptions) {}

	// ------------------------------------------------------------
	// Contacts & lists
	// ------------------------------------------------------------

	/** Creates or updates (matched by email) a single contact via the sign-up form endpoint. */
	async upsertContact(input: CcUpsertContactInput): Promise<{ contactId: string }> {
		const body: Record<string, unknown> = { email_address: input.email.toLowerCase() };
		if (input.firstName !== undefined) body.first_name = input.firstName;
		if (input.lastName !== undefined) body.last_name = input.lastName;
		if (input.jobTitle !== undefined) body.job_title = input.jobTitle;
		if (input.companyName !== undefined) body.company_name = input.companyName;
		if (input.listIds && input.listIds.length > 0) body.list_memberships = input.listIds;

		const payload = await this.request<CcRawSignUpFormResponse>("POST", "/contacts/sign_up_form", body);
		const contactId = payload?.contact_id ?? null;
		if (!contactId) {
			throw new ExternalApiError(PROVIDER, "sign_up_form response did not include contact_id", payload);
		}
		return { contactId };
	}

	/** Kicks off an async JSON bulk import into the given lists; returns the CC activity id. */
	async bulkImportContacts(rows: CcBulkImportRow[], listIds: string[]): Promise<{ activityId: string }> {
		const payload = await this.request<CcRawActivityResponse>("POST", "/activities/contacts_json_import", {
			import_data: rows,
			list_ids: listIds,
		});
		const activityId = payload?.activity_id ?? null;
		if (!activityId) {
			throw new ExternalApiError(
				PROVIDER,
				"contacts_json_import response did not include activity_id",
				payload,
			);
		}
		return { activityId };
	}

	async createList(name: string, description?: string): Promise<{ listId: string }> {
		const body: Record<string, unknown> = { name };
		if (description !== undefined) body.description = description;

		const payload = await this.request<{ list_id?: string | null }>("POST", "/contact_lists", body);
		const listId = payload?.list_id ?? null;
		if (!listId) {
			throw new ExternalApiError(PROVIDER, "contact_lists response did not include list_id", payload);
		}
		return { listId };
	}

	async getLists(): Promise<Array<{ listId: string; name: string }>> {
		const lists: Array<{ listId: string; name: string }> = [];
		let next: string | null = `/contact_lists?limit=${PAGE_LIMIT}`;
		while (next) {
			const payload: CcRawListsPage | undefined = await this.request<CcRawListsPage>("GET", next);
			for (const list of payload?.lists ?? []) {
				const listId = list?.list_id ?? null;
				if (!listId) continue;
				lists.push({ listId, name: list?.name ?? "" });
			}
			next = payload?._links?.next?.href ?? null;
		}
		return lists;
	}

	// ------------------------------------------------------------
	// Email campaigns
	// ------------------------------------------------------------

	/** Creates a custom-code (format_type 5) email campaign; returns campaign + primary activity ids. */
	async createEmailCampaign(
		input: CcCreateEmailCampaignInput,
	): Promise<{ campaignId: string; activityId: string }> {
		const payload = await this.request<CcRawEmailCampaignResponse>("POST", "/emails", {
			name: input.name,
			email_campaign_activities: [
				{
					format_type: 5,
					from_name: input.fromName,
					from_email: input.fromEmail,
					reply_to_email: input.replyTo,
					subject: input.subject,
					html_content: input.htmlContent,
				},
			],
		});

		const activities = payload?.campaign_activities ?? [];
		const primary = activities.find((activity) => activity?.role === "primary_email") ?? activities[0];
		const campaignId = payload?.campaign_id ?? null;
		const activityId = primary?.campaign_activity_id ?? null;
		if (!campaignId || !activityId) {
			throw new ExternalApiError(
				PROVIDER,
				"email campaign response missing campaign_id or primary campaign_activity_id",
				payload,
			);
		}
		return { campaignId, activityId };
	}

	/** CC requires a full-document PUT: fetch the activity, set contact_list_ids, PUT it back. */
	async setActivityLists(activityId: string, listIds: string[]): Promise<void> {
		const document = await this.request<Record<string, unknown>>("GET", `/emails/activities/${activityId}`);
		if (!document) {
			throw new ExternalApiError(PROVIDER, `email activity ${activityId} returned an empty document`);
		}
		const { _links: _ignored, ...rest } = document;
		await this.request<unknown>("PUT", `/emails/activities/${activityId}`, {
			...rest,
			contact_list_ids: listIds,
		});
	}

	async scheduleActivity(activityId: string, scheduledDateIso: string): Promise<void> {
		await this.request<unknown>("POST", `/emails/activities/${activityId}/schedules`, {
			scheduled_date: scheduledDateIso,
		});
	}

	async unscheduleActivity(activityId: string): Promise<void> {
		await this.request<unknown>("DELETE", `/emails/activities/${activityId}/schedules`);
	}

	async sendTest(activityId: string, emails: string[]): Promise<void> {
		await this.request<unknown>("POST", `/emails/activities/${activityId}/tests`, {
			email_addresses: emails,
		});
	}

	// ------------------------------------------------------------
	// Reporting
	// ------------------------------------------------------------

	async getUniqueOpens(activityId: string): Promise<CcTrackingRow[]> {
		return (await this.getTracking(activityId, "unique_opens")).map(toTrackingRow);
	}

	async getClicks(activityId: string): Promise<CcTrackingRow[]> {
		return (await this.getTracking(activityId, "clicks")).map(toTrackingRow);
	}

	async getBounces(activityId: string): Promise<CcBounceRow[]> {
		return (await this.getTracking(activityId, "bounces")).map((raw) => ({
			...toTrackingRow(raw),
			bounceCode: raw.bounce_code ?? null,
		}));
	}

	async getOptouts(activityId: string): Promise<CcTrackingRow[]> {
		return (await this.getTracking(activityId, "optouts")).map(toTrackingRow);
	}

	async getSends(activityId: string): Promise<CcTrackingRow[]> {
		return (await this.getTracking(activityId, "sends")).map(toTrackingRow);
	}

	async getActivityStats(activityId: string): Promise<CcActivityStats> {
		const payload = await this.request<CcRawStatsResponse>(
			"GET",
			`/reports/stats/email_campaign_activities/${activityId}`,
		);
		// CC semantics: em_opens / em_clicks are UNIQUE counts, *_all are totals.
		const stats: CcRawStatsCounts = payload?.results?.[0]?.stats ?? {};
		const uniqueOpens = numberOr(stats.em_opens, 0);
		const uniqueClicks = numberOr(stats.em_clicks, 0);
		return {
			sends: numberOr(stats.em_sends, 0),
			opens: numberOr(stats.em_opens_all, uniqueOpens),
			uniqueOpens,
			clicks: numberOr(stats.em_clicks_all, uniqueClicks),
			uniqueClicks,
			bounces: numberOr(stats.em_bounces, 0),
			optouts: numberOr(stats.em_optouts, 0),
		};
	}

	// ------------------------------------------------------------
	// Internals
	// ------------------------------------------------------------

	private async getTracking(activityId: string, kind: string): Promise<CcRawTrackingActivity[]> {
		const rows: CcRawTrackingActivity[] = [];
		let next: string | null = `/reports/email_reports/${activityId}/tracking/${kind}?limit=${PAGE_LIMIT}`;
		while (next) {
			const payload: CcRawTrackingPage | undefined = await this.request<CcRawTrackingPage>("GET", next);
			for (const row of payload?.tracking_activities ?? []) {
				if (row) rows.push(row);
			}
			next = payload?._links?.next?.href ?? null;
		}
		return rows;
	}

	/** `_links.next.href` comes back as "/v3/…" — resolve it against the API host, not the /v3 base. */
	private resolveUrl(pathOrUrl: string): string {
		if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;
		if (pathOrUrl.startsWith("/v3/")) return `${CC_API_HOST}${pathOrUrl}`;
		return `${CC_BASE_URL}${pathOrUrl}`;
	}

	private async request<T>(method: string, pathOrUrl: string, body?: unknown): Promise<T> {
		const url = this.resolveUrl(pathOrUrl);
		let token = await this.opts.getAccessToken();
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
				token = await (this.opts.getFreshAccessToken ?? this.opts.getAccessToken)();
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

function toTrackingRow(raw: CcRawTrackingActivity): CcTrackingRow {
	return {
		contactId: raw.contact_id ?? "",
		email: (raw.email_address ?? "").toLowerCase(),
		createdTime:
			raw.created_time ?? raw.open_time ?? raw.click_time ?? raw.send_time ?? raw.opt_out_time ?? null,
		count: numberOr(raw.count ?? raw.open_count ?? raw.click_count, 1),
	};
}
