import { type CampaignStatus, type Prisma, prisma } from "@cqsd/db";
import type { CcListedCampaign, CcListedContact } from "@cqsd/integrations";
import { ccClient } from "../infrastructure/integrations";
import type { SegmentCriteria } from "../validators/segments.validator";
import { audit } from "./audit.service";
import { syncCampaignStats } from "./campaign-sync.service";
import { inferPersonaFromTitle } from "./contacts.service";
import { materializeSegment } from "./segment-membership";

/** DB writes are chunked at this size — comfortably under Postgres's per-statement parameter limit. */
const WRITE_CHUNK_SIZE = 2000;

export type ImportProgress = (info: { phase: string; completed: number; total: number }) => void;

function chunk<T>(items: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
	return chunks;
}

/**
 * Maps Constant Contact's free-text `current_status` to our closed CampaignStatus
 * enum. CC's wording has drifted over API versions ("Executing" vs "Sending",
 * "Done" vs "Sent"), so this matches on substrings rather than an exact set.
 * Anything unrecognized is treated as SENT — imported campaigns are assumed to
 * already be live in the account rather than mid-draft.
 */
function mapCcStatus(raw: string | null): CampaignStatus {
	const status = (raw ?? "").toLowerCase();
	if (status.includes("draft")) return "DRAFT";
	if (status.includes("schedul")) return "SCHEDULED";
	if (status.includes("execut") || status.includes("sending")) return "SENDING";
	if (status.includes("error") || status.includes("fail") || status.includes("remov")) return "FAILED";
	return "SENT";
}

/** first_name/last_name are optional on a CC contact — fall back to the email's local part. */
function deriveName(contact: CcListedContact): { firstName: string; lastName: string } {
	const firstName = contact.firstName?.trim();
	if (firstName) return { firstName, lastName: contact.lastName?.trim() ?? "" };
	const localPart = contact.email.split("@")[0] ?? contact.email;
	return { firstName: localPart, lastName: contact.lastName?.trim() ?? "" };
}

/**
 * Resolves every company name referenced by `contacts` to an Organization id,
 * creating whatever doesn't exist yet — in two batched round-trips total, not
 * one findOrCreate call per contact. Real CC accounts can have 100k+ contacts
 * but only a few thousand distinct companies among them.
 */
async function resolveOrganizationIds(contacts: CcListedContact[]): Promise<Map<string, string>> {
	const names = new Set<string>();
	for (const c of contacts) {
		const name = c.companyName?.trim();
		if (name) names.add(name);
	}

	const existing = await prisma.organization.findMany({
		where: { name: { in: [...names], mode: "insensitive" } },
		select: { id: true, name: true },
	});
	const idByLowerName = new Map(existing.map((o) => [o.name.toLowerCase(), o.id] as const));

	const missing = [...names].filter((name) => !idByLowerName.has(name.toLowerCase()));
	if (missing.length > 0) {
		// Two different CC contacts can carry the same company name in different
		// casing — dedupe case-insensitively before inserting so createMany's
		// skipDuplicates isn't relied on to catch case variants (it won't).
		const seen = new Set<string>();
		const toInsert: string[] = [];
		for (const name of missing) {
			const key = name.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				toInsert.push(name);
			}
		}
		for (const batch of chunk(toInsert, WRITE_CHUNK_SIZE)) {
			const created = await prisma.organization.createManyAndReturn({
				data: batch.map((name) => ({ name })),
				skipDuplicates: true,
				select: { id: true, name: true },
			});
			for (const org of created) idByLowerName.set(org.name.toLowerCase(), org.id);
		}
	}

	return idByLowerName;
}

async function importContacts(onProgress?: ImportProgress): Promise<{ created: number; updated: number }> {
	onProgress?.({ phase: "Fetching contacts from Constant Contact", completed: 0, total: 0 });
	const ccContacts = await ccClient.listContacts();

	onProgress?.({ phase: "Resolving companies", completed: 0, total: ccContacts.length });
	const orgIdByLowerName = await resolveOrganizationIds(ccContacts);

	const existingContacts = await prisma.contact.findMany({
		select: { id: true, ccContactId: true, email: true },
	});
	const idByCcId = new Map(
		existingContacts.filter((c) => c.ccContactId).map((c) => [c.ccContactId as string, c.id] as const),
	);
	const idByEmail = new Map(existingContacts.map((c) => [c.email, c.id] as const));

	const toCreate: Prisma.ContactCreateManyInput[] = [];
	const toUpdate: Array<{ id: string; data: Prisma.ContactUncheckedUpdateInput }> = [];

	for (const ccContact of ccContacts) {
		const orgId = ccContact.companyName?.trim()
			? (orgIdByLowerName.get(ccContact.companyName.trim().toLowerCase()) ?? null)
			: null;
		const { firstName, lastName } = deriveName(ccContact);
		const persona = inferPersonaFromTitle(ccContact.jobTitle) ?? undefined;
		const existingId = idByCcId.get(ccContact.contactId) ?? idByEmail.get(ccContact.email);

		if (existingId) {
			toUpdate.push({
				id: existingId,
				data: {
					firstName,
					lastName,
					title: ccContact.jobTitle ?? undefined,
					persona,
					orgId: orgId ?? undefined,
					ccContactId: ccContact.contactId,
				},
			});
		} else {
			toCreate.push({
				firstName,
				lastName,
				email: ccContact.email,
				title: ccContact.jobTitle ?? null,
				persona: persona ?? null,
				orgId,
				source: "CONSTANT_CONTACT",
				ccContactId: ccContact.contactId,
			});
		}
	}

	let created = 0;
	for (const batch of chunk(toCreate, WRITE_CHUNK_SIZE)) {
		const result = await prisma.contact.createMany({ data: batch, skipDuplicates: true });
		created += result.count;
		onProgress?.({ phase: "Creating contacts", completed: created, total: toCreate.length });
	}

	let updated = 0;
	for (const batch of chunk(toUpdate, 200)) {
		await prisma.$transaction(
			batch.map((row) => prisma.contact.update({ where: { id: row.id }, data: row.data })),
		);
		updated += batch.length;
		onProgress?.({ phase: "Updating contacts", completed: updated, total: toUpdate.length });
	}

	if (created + updated > 0) {
		onProgress?.({ phase: "Re-materializing segments", completed: 0, total: 0 });
		const segments = await prisma.segment.findMany({ select: { id: true, criteriaJson: true } });
		for (const segment of segments) {
			await materializeSegment(segment.id, (segment.criteriaJson ?? {}) as SegmentCriteria);
		}
	}

	return { created, updated };
}

async function importCampaigns(
	onProgress?: ImportProgress,
): Promise<{ created: number; updated: number; skipped: number }> {
	onProgress?.({ phase: "Fetching campaigns from Constant Contact", completed: 0, total: 0 });
	const ccCampaigns = await ccClient.listCampaigns();

	const existing = await prisma.campaign.findMany({
		where: { ccActivityId: { not: null } },
		select: { id: true, ccActivityId: true },
	});
	const idByActivityId = new Map(existing.map((c) => [c.ccActivityId as string, c.id] as const));

	const toCreate: Prisma.CampaignCreateManyInput[] = [];
	const toUpdate: Array<{ id: string; data: Prisma.CampaignUpdateInput }> = [];
	let skipped = 0;

	const withActivity = ccCampaigns.filter((c): c is CcListedCampaign & { activityId: string } => {
		if (c.activityId) return true;
		// No primary send activity (e.g. an automation trigger, not a one-off email) — nothing to track.
		skipped += 1;
		return false;
	});

	for (let i = 0; i < withActivity.length; i++) {
		const ccCampaign = withActivity[i] as CcListedCampaign & { activityId: string };
		const detail = await ccClient.getEmailActivity(ccCampaign.activityId);
		const status = mapCcStatus(detail.currentStatus ?? ccCampaign.currentStatus);
		const name = ccCampaign.name || detail.subject || "Untitled campaign";

		const data = {
			name,
			subject: detail.subject ?? name,
			fromName: detail.fromName,
			fromEmail: detail.fromEmail?.toLowerCase() ?? null,
			replyTo: detail.replyToEmail?.toLowerCase() ?? null,
			htmlContent: detail.htmlContent,
			status,
			ccCampaignId: ccCampaign.campaignId,
		};

		const existingId = idByActivityId.get(ccCampaign.activityId);
		if (existingId) {
			toUpdate.push({ id: existingId, data });
		} else {
			toCreate.push({ ...data, ccActivityId: ccCampaign.activityId });
		}

		if ((i + 1) % 20 === 0 || i === withActivity.length - 1) {
			onProgress?.({ phase: "Fetching campaign detail", completed: i + 1, total: withActivity.length });
		}
	}

	let created = 0;
	for (const batch of chunk(toCreate, WRITE_CHUNK_SIZE)) {
		const result = await prisma.campaign.createMany({ data: batch, skipDuplicates: true });
		created += result.count;
	}

	let updated = 0;
	for (const batch of chunk(toUpdate, 200)) {
		await prisma.$transaction(
			batch.map((row) => prisma.campaign.update({ where: { id: row.id }, data: row.data })),
		);
		updated += batch.length;
	}

	return { created, updated, skipped };
}

export const CcImportService = {
	/**
	 * One-shot pull of everything already sitting in the connected Constant Contact
	 * account — contacts and campaigns this app never created — followed by a stats
	 * backfill for every campaign that now has a ccActivityId. Safe to re-run: every
	 * write is an upsert keyed on the CC id, so nothing duplicates on a second import.
	 * Every DB write is batched (createMany / chunked transactions), not one row at a
	 * time — real accounts can have well over 100k contacts.
	 */
	async importAll(userId: string | null, onProgress?: ImportProgress) {
		const contacts = await importContacts(onProgress);
		const campaigns = await importCampaigns(onProgress);
		onProgress?.({ phase: "Syncing campaign stats", completed: 0, total: 0 });
		const { syncedCampaigns } = await syncCampaignStats();

		await audit(userId, "connections.import_constant_contact", "connection", {
			contactsCreated: contacts.created,
			contactsUpdated: contacts.updated,
			campaignsCreated: campaigns.created,
			campaignsUpdated: campaigns.updated,
			campaignsSkipped: campaigns.skipped,
			statsSynced: syncedCampaigns,
		});

		return { contacts, campaigns, statsSynced: syncedCampaigns };
	},
};
