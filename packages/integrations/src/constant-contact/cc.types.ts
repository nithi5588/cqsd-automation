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
	/** CC list ids this contact belongs to — only present when fetched with include=list_memberships. */
	listMemberships: string[];
	/** CC tag ids this contact carries — only present when fetched with include=taggings. */
	tagIds: string[];
	/** Raw custom field id/value pairs — only present when fetched with include=custom_fields. */
	customFieldValues: Array<{ customFieldId: string; value: string }>;
}

/** One Contact Tag defined on the account (Contact Tags API — lighter-weight than a list). */
export interface CcContactTag {
	tagId: string;
	name: string;
}

/** One Custom Field defined on the account (arbitrary per-account schema). */
export interface CcCustomFieldDef {
	customFieldId: string;
	label: string;
}

/**
 * One of Constant Contact's own dynamic Segments (rule-based, segment_criteria) —
 * a different feature from Contact Lists: membership is computed by CC from a
 * rule, not manually maintained.
 */
export interface CcSegmentSummary {
	segmentId: string;
	name: string;
}

/** Account-level info (GET /v3/account/summary) — read-only, surfaced on the Connections page. */
export interface CcAccountSummary {
	organizationName: string | null;
	accountName: string | null;
	timeZone: string | null;
	countryCode: string | null;
}

/**
 * One campaign already sitting in the connected Constant Contact account.
 * The list endpoint (GET /v3/emails) never includes campaign_activities — that
 * only appears on the full campaign resource (GET /v3/emails/{id}), fetched
 * separately via `getCampaign`.
 */
export interface CcListedCampaign {
	campaignId: string;
	name: string;
	/** Raw CC status string (e.g. "Draft", "Scheduled", "Executing", "Done") — mapped by the caller. */
	currentStatus: string | null;
}

/** Full campaign resource — the only place campaign_activities (and so the activity id) shows up. */
export interface CcCampaignDetail {
	/** Primary send activity id — "primary_email" role, falling back to the first activity. */
	activityId: string | null;
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

export interface CcRawTagging {
	tag_id?: string | null;
}

export interface CcRawContactCustomFieldValue {
	custom_field_id?: string | null;
	value?: string | null;
}

export interface CcRawContact {
	contact_id?: string | null;
	email_address?: CcRawContactEmailAddress | string | null;
	first_name?: string | null;
	last_name?: string | null;
	job_title?: string | null;
	company_name?: string | null;
	/** Only present when the request included `include=list_memberships`. */
	list_memberships?: string[] | null;
	/** Only present when the request included `include=taggings`. */
	taggings?: CcRawTagging[] | null;
	/** Only present when the request included `include=custom_fields`. */
	custom_fields?: CcRawContactCustomFieldValue[] | null;
}

export interface CcRawContactsPage {
	contacts?: CcRawContact[] | null;
	_links?: CcRawLinks | null;
}

/** Shape returned by the LIST endpoint (GET /v3/emails) — no campaign_activities here. */
export interface CcRawCampaignSummary {
	campaign_id?: string | null;
	name?: string | null;
	current_status?: string | null;
}

export interface CcRawCampaignsPage {
	campaigns?: CcRawCampaignSummary[] | null;
	_links?: CcRawLinks | null;
}

/** Shape returned by the single-campaign resource (GET /v3/emails/{id}) — this is where campaign_activities lives. */
export interface CcRawCampaignDetail {
	campaign_id?: string | null;
	current_status?: string | null;
	campaign_activities?: CcRawCampaignActivity[] | null;
}

export interface CcRawEmailActivityDocument {
	subject?: string | null;
	from_name?: string | null;
	from_email?: string | null;
	reply_to_email?: string | null;
	html_content?: string | null;
	current_status?: string | null;
}

export interface CcRawTag {
	tag_id?: string | null;
	name?: string | null;
}

export interface CcRawTagsPage {
	tags?: CcRawTag[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawCustomFieldDef {
	custom_field_id?: string | null;
	label?: string | null;
}

export interface CcRawCustomFieldsPage {
	custom_fields?: CcRawCustomFieldDef[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawSegmentSummary {
	segment_id?: string | null;
	name?: string | null;
}

export interface CcRawSegmentsPage {
	segments?: CcRawSegmentSummary[] | null;
	_links?: CcRawLinks | null;
}

/**
 * The segment-membership endpoint's exact response shape isn't independently
 * verified against a live account — every field here is optional and the client
 * tries several plausible shapes, so a docs drift degrades to an empty list
 * instead of throwing.
 */
export interface CcRawSegmentContact {
	contact_id?: string | null;
}

export interface CcRawSegmentContactsPage {
	contact_ids?: string[] | null;
	contacts?: CcRawSegmentContact[] | null;
	_links?: CcRawLinks | null;
}

export interface CcRawAccountSummary {
	organization_name?: string | null;
	name?: string | null;
	time_zone?: string | null;
	country_code?: string | null;
}
