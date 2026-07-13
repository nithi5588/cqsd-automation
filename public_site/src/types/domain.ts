import type { UserRole } from "@/types";

export type { UserRole };

// ============================================================
// Enums (string unions mirroring the backend Prisma enums)
// ============================================================

export type Persona = "IT" | "LINE_OF_BUSINESS" | "CUSTOMER_SERVICE";

/** Account-plan persona rollups bucket contacts without a persona under "UNKNOWN". */
export type PersonaBucket = Persona | "UNKNOWN";

export type ContactSource = "MANUAL" | "CSV_IMPORT" | "LEADGEN" | "WEBSITE" | "TEAMS" | "CONSTANT_CONTACT";

export type SegmentType = "INDUSTRY" | "AE" | "PERSONA" | "ALL" | "CC_LIST";

export type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED";

export type WebinarStatus = "DRAFT" | "PUBLISHED" | "CANCELED" | "COMPLETED";

export type RegistrationSource = "WEBSITE" | "TEAMS";

export type LeadImportSource = "CSV" | "LEADGEN";

export type LeadImportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

// ============================================================
// Shared shapes
// ============================================================

export interface Paginated<T> {
	items: T[];
	page: number;
	pageSize: number;
	total: number;
}

export interface PageParams {
	page?: number;
	pageSize?: number;
}

/** Minimal organization reference embedded on contact/campaign rows. */
export interface OrgRef {
	id: string;
	name: string;
}

// ============================================================
// Organizations
// ============================================================

export interface Organization {
	id: string;
	name: string;
	industry: string | null;
	revenue: number | null;
	aeOwner: string | null;
	createdAt: string;
	updatedAt?: string;
}

export interface OrganizationListItem {
	id: string;
	name: string;
	industry: string | null;
	revenue: number | null;
	aeOwner: string | null;
	contactCount: number;
	createdAt: string;
}

export interface OrganizationDetail extends Organization {
	contacts: ContactListItem[];
}

export interface OrganizationCreateInput {
	name: string;
	industry?: string;
	revenue?: number;
	aeOwner?: string;
}

export type OrganizationUpdateInput = Partial<OrganizationCreateInput>;

export interface OrganizationListParams extends PageParams {
	search?: string;
	industry?: string;
	aeOwner?: string;
}

// ============================================================
// Contacts
// ============================================================

export interface ContactListItem {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	title: string | null;
	industry: string | null;
	persona: Persona | null;
	source: ContactSource;
	ccContactId: string | null;
	ccSynced: boolean;
	/** Hard-bounced — excluded from segments and Constant Contact pushes. */
	bounced: boolean;
	organization: OrgRef | null;
	createdAt: string;
}

/** One campaign the contact was targeted by, with their engagement. */
export interface ContactActivityRow {
	campaignId: string;
	campaignName: string;
	subject: string;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	firstOpenAt: string | null;
	firstClickAt: string | null;
}

export interface ContactActivity {
	campaignsSent: number;
	opens: number;
	clicks: number;
	rows: ContactActivityRow[];
}

export interface ContactRegistrationRef {
	webinarId: string;
	webinarTitle: string;
	registeredAt: string;
}

export interface ContactAttendanceRef {
	webinarId: string;
	webinarTitle: string;
	durationSeconds: number;
	joinTime: string | null;
}

export interface ContactDetail extends ContactListItem {
	activity: ContactActivity;
	registrations: ContactRegistrationRef[];
	attendance: ContactAttendanceRef[];
}

export interface ContactCreateInput {
	firstName: string;
	lastName: string;
	email: string;
	title?: string;
	industry?: string;
	persona?: Persona;
	orgId?: string;
	orgName?: string;
}

export type ContactUpdateInput = Partial<ContactCreateInput>;

export interface ContactListParams extends PageParams {
	search?: string;
	persona?: Persona;
	industry?: string;
	orgId?: string;
	segmentId?: string;
}

export interface ContactImportRow {
	firstName: string;
	lastName: string;
	email: string;
	title?: string;
	industry?: string;
	persona?: Persona;
	orgName?: string;
	aeOwner?: string;
}

export interface ContactImportInput {
	source: LeadImportSource;
	rows: ContactImportRow[];
}

export interface ImportResult {
	job: {
		id: string;
		status: LeadImportStatus;
		count: number;
	};
	created: number;
	updated: number;
	skipped: Array<{ email: string; reason: string }>;
}

// ============================================================
// Segments
// ============================================================

export interface SegmentCriteria {
	industry?: string;
	aeOwner?: string;
	persona?: Persona;
	all?: boolean;
}

export interface Segment {
	id: string;
	name: string;
	type: SegmentType;
	criteria: SegmentCriteria;
	memberCount: number;
	ccSegmentId: string | null;
	ccSynced: boolean;
	createdAt: string;
}

/** Response shape of `GET /segments/:id`. */
export interface SegmentDetail {
	segment: Segment;
	members: Paginated<ContactListItem>;
}

export interface SegmentCreateInput {
	name: string;
	type: SegmentType;
	criteria: SegmentCriteria;
}

export interface SegmentUpdateInput {
	name?: string;
	criteria?: SegmentCriteria;
}

export interface SegmentSyncResult {
	ccListId: string;
	pushed: number;
}

// ============================================================
// Leads
// ============================================================

export interface LeadImportJob {
	id: string;
	source: LeadImportSource;
	status: LeadImportStatus;
	count: number;
	fileRef: string | null;
	error: string | null;
	createdAt: string;
}

// ============================================================
// Campaigns
// ============================================================

export interface CampaignStat {
	sends: number;
	opens: number;
	uniqueOpens: number;
	clicks: number;
	uniqueClicks: number;
	bounces: number;
	optouts: number;
	lastSyncedAt: string | null;
}

export interface CampaignListItem {
	id: string;
	name: string;
	subject: string;
	status: CampaignStatus;
	volumeNumber: number | null;
	scheduledAt: string | null;
	fromName: string | null;
	fromEmail: string | null;
	webinar: { id: string; title: string } | null;
	segment: { id: string; name: string } | null;
	ccCampaignId: string | null;
	ccActivityId: string | null;
	stat: CampaignStat | null;
	createdAt: string;
}

export interface CampaignDetail extends CampaignListItem {
	htmlContent: string | null;
	templateId: string | null;
	replyTo: string | null;
}

export interface CampaignCreateInput {
	name: string;
	subject: string;
	fromName: string;
	fromEmail: string;
	replyTo?: string;
	htmlContent?: string;
	templateId?: string;
	webinarId?: string;
	volumeNumber?: number;
	segmentId?: string;
	scheduledAt?: string;
}

export type CampaignUpdateInput = Partial<CampaignCreateInput>;

export interface CampaignListParams extends PageParams {
	status?: CampaignStatus;
	search?: string;
}

export type CampaignActivityFilter = "all" | "opened" | "clicked";

export interface CampaignActivityParams extends PageParams {
	filter?: CampaignActivityFilter;
	search?: string;
}

/** Per-contact engagement row for a campaign (`GET /campaigns/:id/activity`). */
export interface CampaignActivityRow {
	contactId: string;
	firstName: string;
	lastName: string;
	email: string;
	title: string | null;
	persona: Persona | null;
	organization: OrgRef | null;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	firstOpenAt: string | null;
	firstClickAt: string | null;
}

/** Company rollup row for a campaign (`GET /campaigns/:id/activity/by-company`). */
export interface CompanyActivityRow {
	orgId: string | null;
	orgName: string;
	contacts: number;
	opened: number;
	clicked: number;
	openCount: number;
	clickCount: number;
}

// ============================================================
// Webinars
// ============================================================

export interface WebinarListItem {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	startsAt: string;
	endsAt: string;
	timeZone: string;
	status: WebinarStatus;
	organizerUpn: string;
	msWebinarId: string | null;
	joinUrl: string | null;
	registrationUrl: string | null;
	registrationCount: number;
	attendanceCount: number;
	createdAt: string;
}

export interface WebinarCampaignRow {
	id: string;
	name: string;
	status: CampaignStatus;
	volumeNumber: number | null;
	stat: CampaignStat | null;
}

export interface WebinarDetail extends WebinarListItem {
	campaigns: WebinarCampaignRow[];
}

export interface WebinarCreateInput {
	title: string;
	description?: string;
	startsAt: string;
	endsAt: string;
	timeZone: string;
}

export type WebinarUpdateInput = Partial<WebinarCreateInput>;

export interface WebinarListParams extends PageParams {
	status?: WebinarStatus;
}

export interface RegistrationRow {
	id: string;
	name: string;
	email: string;
	source: RegistrationSource;
	registeredAt: string;
	contactId: string | null;
	joinUrl: string | null;
}

export interface AttendanceRow {
	id: string;
	email: string;
	name: string | null;
	contactId: string | null;
	joinTime: string | null;
	leaveTime: string | null;
	durationSeconds: number;
	attended: boolean;
	registered: boolean;
}

export interface AttendanceSummary {
	total: number;
	registrations: number;
	/** Attended / registrations, 0–1 (0 when there are no registrations). */
	showRate: number;
	avgDurationSeconds: number;
}

export interface WebinarAttendanceResponse extends Paginated<AttendanceRow> {
	summary: AttendanceSummary;
}

export interface AttendanceSyncResult {
	synced: number;
	matchedContacts: number;
}

export interface PublicRegistrationInput {
	name: string;
	email: string;
	company?: string;
}

export interface PublicRegistrationResult {
	ok: boolean;
	joinUrl: string | null;
}

// ============================================================
// Account plans
// ============================================================

export interface AccountPlanListItem {
	orgId: string;
	name: string;
	industry: string | null;
	aeOwner: string | null;
	contacts: number;
	emailsSent: number;
	uniqueOpens: number;
	uniqueClicks: number;
	attendees: number;
	/** 0–1 */
	openRate: number;
	/** 0–1 */
	clickRate: number;
	lastActivityAt: string | null;
}

export interface AccountPlanPersonaRow {
	persona: PersonaBucket;
	contacts: number;
}

export interface AccountPlanTotals {
	contacts: number;
	emailsSent: number;
	opens: number;
	uniqueOpens: number;
	clicks: number;
	uniqueClicks: number;
	webinarsAttended: number;
	attendedSeconds: number;
}

export interface AccountPlanContactRow {
	contactId: string;
	name: string;
	email: string;
	title: string | null;
	persona: Persona | null;
	sent: number;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	webinarsAttended: number;
	totalAttendedSeconds: number;
	lastEngagedAt: string | null;
}

export interface AccountPlanCampaignRow {
	campaignId: string;
	name: string;
	subject: string;
	status: CampaignStatus;
	sends: number;
	uniqueOpens: number;
	uniqueClicks: number;
}

export interface AccountPlanWebinarRow {
	webinarId: string;
	title: string;
	startsAt: string;
	registered: number;
	attended: number;
}

export interface AccountPlan {
	organization: {
		id: string;
		name: string;
		industry: string | null;
		revenue: number | null;
		aeOwner: string | null;
	};
	personas: AccountPlanPersonaRow[];
	totals: AccountPlanTotals;
	contacts: AccountPlanContactRow[];
	campaigns: AccountPlanCampaignRow[];
	webinars: AccountPlanWebinarRow[];
}

/** Webinar-scoped account plan (`GET /webinars/:id/account-plan`). */
export type WebinarAccountPlan = Omit<AccountPlan, "organization"> & {
	webinar: { id: string; title: string };
};

export interface AccountPlanListParams extends PageParams {
	search?: string;
}

// ============================================================
// Overview
// ============================================================

export interface OverviewKpis {
	contacts: number;
	organizations: number;
	campaignsSent: number;
	avgOpenRate: number | null;
	avgClickRate: number | null;
	upcomingWebinars: number;
	totalAttendees: number;
	ccConnected: boolean;
	msConnected: boolean;
}

export interface TopCompanyRow {
	orgId: string;
	name: string;
	uniqueOpens: number;
	uniqueClicks: number;
}

export interface EngagementTrendPoint {
	/** "YYYY-MM-DD" */
	date: string;
	opens: number;
	clicks: number;
}

/** Lifetime email→webinar funnel totals. */
export interface OverviewFunnel {
	sends: number;
	uniqueOpens: number;
	uniqueClicks: number;
	registrations: number;
	/** Distinct (lowercased) attendee emails with attended=true. */
	attendees: number;
}

/** One SENT campaign with stats — last six by scheduled (fallback created) time. */
export interface OverviewCampaignPerformanceRow {
	campaignId: string;
	name: string;
	volumeNumber: number | null;
	sends: number;
	/** uniqueOpens / sends, 0–1 */
	openRate: number | null;
	/** uniqueClicks / sends, 0–1 */
	clickRate: number | null;
}

/** One webinar with registrations — last five by start time. */
export interface OverviewWebinarShowRateRow {
	webinarId: string;
	title: string;
	startsAt: string;
	registrations: number;
	attended: number;
}

/** Contact counts per persona bucket (null persona → UNKNOWN); all four rows always present. */
export interface OverviewPersonaRow {
	persona: PersonaBucket;
	contacts: number;
}

export interface OverviewAttention {
	draftCampaigns: number;
	scheduledCampaigns: number;
	nextScheduledAt: string | null;
	completedWebinarsWithoutAttendance: number;
	bouncedContacts: number;
}

/** Audit-log entry surfaced on the overview (6 newest). */
export interface OverviewActivityRow {
	id: string;
	action: string;
	entity: string;
	userEmail: string | null;
	createdAt: string;
}

export interface OverviewData {
	kpis: OverviewKpis;
	recentCampaigns: CampaignListItem[];
	upcomingWebinars: WebinarListItem[];
	topCompanies: TopCompanyRow[];
	engagementTrend: EngagementTrendPoint[];
	funnel: OverviewFunnel;
	campaignPerformance: OverviewCampaignPerformanceRow[];
	webinarShowRates: OverviewWebinarShowRateRow[];
	personas: OverviewPersonaRow[];
	attention: OverviewAttention;
	recentActivity: OverviewActivityRow[];
}

// ============================================================
// Admin
// ============================================================

export interface AdminUser {
	id: string;
	email: string;
	role: UserRole;
	createdAt: string;
}

export interface AdminUserCreateInput {
	email: string;
	password: string;
	role: UserRole;
}

export interface AdminUserUpdateInput {
	role?: UserRole;
	password?: string;
}

export interface AuditRow {
	id: string;
	userId: string | null;
	userEmail: string | null;
	action: string;
	entity: string;
	meta: unknown;
	createdAt: string;
}
