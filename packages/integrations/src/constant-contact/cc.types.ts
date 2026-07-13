// ============================================================
// Constant Contact v3 — public shapes returned by ConstantContactClient
// plus the raw wire payloads it parses (all-optional so every read is
// defensive against schema drift).
// ============================================================

/** One normalized row from any tracking report (opens / clicks / sends / optouts). */
export interface CcTrackingRow {
	contactId: string;
	/** Always lowercased so callers can match `Contact.email` directly. */
	email: string;
	createdTime: string | null;
	/** Per-row count when Constant Contact reports one, otherwise 1. */
	count: number;
}

/** Tracking row from the bounces report, with the CC bounce code attached. */
export interface CcBounceRow extends CcTrackingRow {
	bounceCode: string | null;
}

/**
 * Bounce codes Constant Contact treats as permanent: "B" (suspended),
 * "D" (undeliverable), "Z" (blocked). Soft codes (mailbox full, vacation…) are excluded.
 */
export const CC_HARD_BOUNCE_CODES: readonly string[] = ["B", "D", "Z"];

export function isHardBounce(bounceCode: string | null | undefined): boolean {
	return bounceCode != null && CC_HARD_BOUNCE_CODES.includes(bounceCode.toUpperCase());
}

/** Aggregate counters for one email campaign activity. */
export interface CcActivityStats {
	sends: number;
	opens: number;
	uniqueOpens: number;
	clicks: number;
	uniqueClicks: number;
	bounces: number;
	optouts: number;
}

export interface CcUpsertContactInput {
	email: string;
	firstName?: string;
	lastName?: string;
	jobTitle?: string;
	companyName?: string;
	listIds?: string[];
}

/** Row shape for the JSON bulk-import activity — already in CC's snake_case wire format. */
export interface CcBulkImportRow {
	email: string;
	first_name?: string;
	last_name?: string;
	job_title?: string;
	company_name?: string;
}

export interface CcCreateEmailCampaignInput {
	name: string;
	fromName: string;
	fromEmail: string;
	replyTo: string;
	subject: string;
	htmlContent: string;
}

/** One contact already sitting in the connected Constant Contact account. */
export interface CcListedContact {
	contactId: string;
	email: string;
	firstName: string | null;
	lastName: string | null;
	jobTitle: string | null;
	companyName: string | null;
}

/** One campaign already sitting in the connected Constant Contact account. */
export interface CcListedCampaign {
	campaignId: string;
	name: string;
	/** Primary send activity id — "primary_email" role, falling back to the first activity. */
	activityId: string | null;
	/** Raw CC status string (e.g. "Draft", "Scheduled", "Executing", "Done") — mapped by the caller. */
	currentStatus: string | null;
}

/** Full detail for one email campaign activity (subject/from/content), used to enrich an imported campaign. */
export interface CcEmailActivityDetail {
	subject: string | null;
	fromName: string | null;
	fromEmail: string | null;
	replyToEmail: string | null;
	htmlContent: string | null;
	currentStatus: string | null;
}

// ------------------------------------------------------------
// Raw wire payloads (subset we read; everything optional).
// ------------------------------------------------------------

export interface CcRawLink {
	href?: string | null;
}

export interface CcRawLinks {
	next?: CcRawLink | null;
}

export interface CcRawSignUpFormResponse {
	contact_id?: string | null;
	action?: string | null;
}

export interface CcRawActivityResponse {
	activity_id?: string | null;
	state?: string | null;
}

export interface CcRawList {
	list_id?: string | null;
	name?: string | null;
}

export interface CcRawListsPage {
	lists?: CcRawList[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawCampaignActivity {
	campaign_activity_id?: string | null;
	role?: string | null;
}

export interface CcRawEmailCampaignResponse {
	campaign_id?: string | null;
	campaign_activities?: CcRawCampaignActivity[] | null;
}

export interface CcRawTrackingActivity {
	contact_id?: string | null;
	email_address?: string | null;
	created_time?: string | null;
	open_time?: string | null;
	click_time?: string | null;
	send_time?: string | null;
	opt_out_time?: string | null;
	count?: number | string | null;
	open_count?: number | string | null;
	click_count?: number | string | null;
	bounce_code?: string | null;
}

export interface CcRawTrackingPage {
	tracking_activities?: CcRawTrackingActivity[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawStatsCounts {
	em_sends?: number | string | null;
	em_opens?: number | string | null;
	em_opens_all?: number | string | null;
	em_clicks?: number | string | null;
	em_clicks_all?: number | string | null;
	em_bounces?: number | string | null;
	em_optouts?: number | string | null;
}

export interface CcRawStatsResult {
	campaign_activity_id?: string | null;
	stats?: CcRawStatsCounts | null;
}

export interface CcRawStatsResponse {
	results?: CcRawStatsResult[] | null;
}

export interface CcRawContactEmailAddress {
	address?: string | null;
}

export interface CcRawContact {
	contact_id?: string | null;
	email_address?: CcRawContactEmailAddress | string | null;
	first_name?: string | null;
	last_name?: string | null;
	job_title?: string | null;
	company_name?: string | null;
}

export interface CcRawContactsPage {
	contacts?: CcRawContact[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawCampaignSummary {
	campaign_id?: string | null;
	name?: string | null;
	current_status?: string | null;
	campaign_activities?: CcRawCampaignActivity[] | null;
}

export interface CcRawCampaignsPage {
	campaigns?: CcRawCampaignSummary[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawEmailActivityDocument {
	subject?: string | null;
	from_name?: string | null;
	from_email?: string | null;
	reply_to_email?: string | null;
	html_content?: string | null;
	current_status?: string | null;
}
