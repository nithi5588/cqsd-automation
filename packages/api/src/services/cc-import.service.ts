import { type CampaignStatus, type Prisma, prisma } from "@cqsd/db";
import type { CcListedContact } from "@cqsd/integrations";
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

/**
 * Imports every Constant Contact list ("segment" in CC's UI) as a local Segment
 * of type CC_LIST — membership comes from each contact's list_memberships during
 * `importContacts`, not from criteriaJson, so these are excluded from the
 * criteria-based materializeSegment recompute. Returns ccListId -> local Segment id.
 */
async function importSegments(): Promise<Map<string, string>> {
	const ccLists = await ccClient.getLists();

	const existing = await prisma.segment.findMany({
		where: { ccSegmentId: { not: null } },
		select: { id: true, ccSegmentId: true },
	});
	const idByCcListId = new Map(existing.map((s) => [s.ccSegmentId as string, s.id] as const));

	const toCreate: Prisma.SegmentCreateManyInput[] = ccLists
		.filter((list) => !idByCcListId.has(list.listId))
		.map((list) => ({
			name: list.name || "Untitled list",
			type: "CC_LIST" as const,
			criteriaJson: {},
			ccSegmentId: list.listId,
		}));

	for (const batch of chunk(toCreate, WRITE_CHUNK_SIZE)) {
		const created = await prisma.segment.createManyAndReturn({
			data: batch,
			skipDuplicates: true,
			select: { id: true, ccSegmentId: true },
		});
		for (const segment of created) {
			if (segment.ccSegmentId) idByCcListId.set(segment.ccSegmentId, segment.id);
		}
	}

	return idByCcListId;
}

/**
 * Imports Constant Contact's own dynamic Segments (segment_criteria — a
 * different feature from Contact Lists) as local Segments of type CC_SEGMENT.
 * Unlike CC_LIST, membership can't be read off the contact object — each
 * segment's matching contact ids are fetched separately and resolved against
 * contacts already imported by `importContacts` (must run after it).
 */
async function importCcSegments(
	onProgress?: ImportProgress,
): Promise<{ imported: number; memberships: number }> {
	onProgress?.({ phase: "Fetching Constant Contact segments", completed: 0, total: 0 });
	const ccSegments = await ccClient.listCcSegments();
	if (ccSegments.length === 0) return { imported: 0, memberships: 0 };

	const existing = await prisma.segment.findMany({
		where: { ccSegmentId: { not: null } },
		select: { id: true, ccSegmentId: true },
	});
	const idByCcSegmentId = new Map(existing.map((s) => [s.ccSegmentId as string, s.id] as const));

	const toCreate: Prisma.SegmentCreateManyInput[] = ccSegments
		.filter((s) => !idByCcSegmentId.has(s.segmentId))
		.map((s) => ({
			name: s.name || "Untitled segment",
			type: "CC_SEGMENT" as const,
			criteriaJson: {},
			ccSegmentId: s.segmentId,
		}));

	for (const batch of chunk(toCreate, WRITE_CHUNK_SIZE)) {
		const created = await prisma.segment.createManyAndReturn({
			data: batch,
			skipDuplicates: true,
			select: { id: true, ccSegmentId: true },
		});
		for (const s of created) {
			if (s.ccSegmentId) idByCcSegmentId.set(s.ccSegmentId, s.id);
		}
	}

	let memberships = 0;
	for (let i = 0; i < ccSegments.length; i++) {
		const ccSegment = ccSegments[i] as (typeof ccSegments)[number];
		const localSegmentId = idByCcSegmentId.get(ccSegment.segmentId);
		if (!localSegmentId) continue;

		const ccContactIds = await ccClient.getSegmentContactIds(ccSegment.segmentId);
		const localContactIds: string[] = [];
		for (const idBatch of chunk(ccContactIds, WRITE_CHUNK_SIZE)) {
			const found = await prisma.contact.findMany({
				where: { ccContactId: { in: idBatch } },
				select: { id: true },
			});
			localContactIds.push(...found.map((c) => c.id));
		}

		// CC's rule is the source of truth for this segment — replace membership wholesale.
		await prisma.$transaction([
			prisma.segmentMember.deleteMany({ where: { segmentId: localSegmentId } }),
			prisma.segmentMember.createMany({
				data: localContactIds.map((contactId) => ({ segmentId: localSegmentId, contactId })),
				skipDuplicates: true,
			}),
		]);
		memberships += localContactIds.length;

		onProgress?.({ phase: "Importing segment membership", completed: i + 1, total: ccSegments.length });
	}

	return { imported: toCreate.length, memberships };
}

async function importContacts(
	segmentIdByCcListId: Map<string, string>,
	onProgress?: ImportProgress,
): Promise<{ created: number; updated: number; segmentMemberships: number }> {
	onProgress?.({ phase: "Fetching contacts from Constant Contact", completed: 0, total: 0 });
	const ccContacts = await ccClient.listContacts();

	onProgress?.({
		phase: "Resolving companies, tags and custom fields",
		completed: 0,
		total: ccContacts.length,
	});
	const [orgIdByLowerName, ccTags, ccCustomFields] = await Promise.all([
		resolveOrganizationIds(ccContacts),
		ccClient.listContactTags(),
		ccClient.listCustomFieldDefs(),
	]);
	const tagNameById = new Map(ccTags.map((t) => [t.tagId, t.name] as const));
	const customFieldLabelById = new Map(ccCustomFields.map((f) => [f.customFieldId, f.label] as const));

	const existingContacts = await prisma.contact.findMany({
		select: { id: true, ccContactId: true, email: true },
	});
	const idByCcId = new Map(
		existingContacts.filter((c) => c.ccContactId).map((c) => [c.ccContactId as string, c.id] as const),
	);
	const idByEmail = new Map(existingContacts.map((c) => [c.email, c.id] as const));

	const toCreate: Prisma.ContactCreateManyInput[] = [];
	const toUpdate: Array<{ id: string; data: Prisma.ContactUncheckedUpdateInput }> = [];
	// Resolved local contact id for every CC contact — filled in for existing rows
	// now, and for newly-created rows once createManyAndReturn comes back below.
	// Needed to link contacts to their imported segments afterward.
	const localIdByCcContactId = new Map<string, string>();

	for (const ccContact of ccContacts) {
		const orgId = ccContact.companyName?.trim()
			? (orgIdByLowerName.get(ccContact.companyName.trim().toLowerCase()) ?? null)
			: null;
		const { firstName, lastName } = deriveName(ccContact);
		const persona = inferPersonaFromTitle(ccContact.jobTitle) ?? undefined;
		const tags = ccContact.tagIds
			.map((id) => tagNameById.get(id))
			.filter((name): name is string => Boolean(name));
		const customFields =
			ccContact.customFieldValues.length > 0
				? Object.fromEntries(
						ccContact.customFieldValues
							.map((v) => [customFieldLabelById.get(v.customFieldId), v.value] as const)
							.filter((entry): entry is [string, string] => Boolean(entry[0])),
					)
				: null;
		const existingId = idByCcId.get(ccContact.contactId) ?? idByEmail.get(ccContact.email);

		if (existingId) {
			localIdByCcContactId.set(ccContact.contactId, existingId);
			toUpdate.push({
				id: existingId,
				data: {
					firstName,
					lastName,
					title: ccContact.jobTitle ?? undefined,
					persona,
					orgId: orgId ?? undefined,
					ccContactId: ccContact.contactId,
					tags,
					customFields: customFields ?? undefined,
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
				tags,
				customFields: customFields ?? undefined,
			});
		}
	}

	let created = 0;
	for (const batch of chunk(toCreate, WRITE_CHUNK_SIZE)) {
		const createdRows = await prisma.contact.createManyAndReturn({
			data: batch,
			skipDuplicates: true,
			select: { id: true, ccContactId: true },
		});
		for (const row of createdRows) {
			if (row.ccContactId) localIdByCcContactId.set(row.ccContactId, row.id);
		}
		created += createdRows.length;
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

	let segmentMemberships = 0;
	if (segmentIdByCcListId.size > 0) {
		onProgress?.({ phase: "Linking contacts to imported segments", completed: 0, total: ccContacts.length });
		const memberRows: Prisma.SegmentMemberCreateManyInput[] = [];
		for (const ccContact of ccContacts) {
			const contactId = localIdByCcContactId.get(ccContact.contactId);
			if (!contactId) continue;
			for (const listId of ccContact.listMemberships) {
				const segmentId = segmentIdByCcListId.get(listId);
				if (segmentId) memberRows.push({ segmentId, contactId });
			}
		}
		for (const batch of chunk(memberRows, WRITE_CHUNK_SIZE)) {
			const result = await prisma.segmentMember.createMany({ data: batch, skipDuplicates: true });
			segmentMemberships += result.count;
		}
	}

	if (created + updated > 0) {
		onProgress?.({ phase: "Re-materializing criteria-based segments", completed: 0, total: 0 });
		// CC_LIST / CC_SEGMENT got their membership above, directly from CC —
		// recomputing them here from criteriaJson (which they don't have) would wipe it back out.
		const segments = await prisma.segment.findMany({
			where: { type: { notIn: ["CC_LIST", "CC_SEGMENT"] } },
			select: { id: true, criteriaJson: true },
		});
		for (const segment of segments) {
			await materializeSegment(segment.id, (segment.criteriaJson ?? {}) as SegmentCriteria);
		}
	}

	return { created, updated, segmentMemberships };
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

	for (let i = 0; i < ccCampaigns.length; i++) {
		const ccCampaign = ccCampaigns[i] as (typeof ccCampaigns)[number];

		// The list endpoint never includes campaign_activities — a second call to the
		// full campaign resource is the only way to find the primary send activity id.
		const { activityId } = await ccClient.getCampaign(ccCampaign.campaignId);
		if (!activityId) {
			// No primary send activity (e.g. an automation trigger, not a one-off email) — nothing to track.
			skipped += 1;
			continue;
		}

		const activity = await ccClient.getEmailActivity(activityId);
		const status = mapCcStatus(activity.currentStatus ?? ccCampaign.currentStatus);
		const name = ccCampaign.name || activity.subject || "Untitled campaign";

		const data = {
			name,
			subject: activity.subject ?? name,
			fromName: activity.fromName,
			fromEmail: activity.fromEmail?.toLowerCase() ?? null,
			replyTo: activity.replyToEmail?.toLowerCase() ?? null,
			htmlContent: activity.htmlContent,
			status,
			ccCampaignId: ccCampaign.campaignId,
		};

		const existingId = idByActivityId.get(activityId);
		if (existingId) {
			toUpdate.push({ id: existingId, data });
		} else {
			toCreate.push({ ...data, ccActivityId: activityId });
		}

		if ((i + 1) % 20 === 0 || i === ccCampaigns.length - 1) {
			onProgress?.({ phase: "Fetching campaign detail", completed: i + 1, total: ccCampaigns.length });
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
	 * account — lists and dynamic segments, contacts (linked to both, tagged with
	 * their CC tags and custom fields), and campaigns this app never created —
	 * followed by a stats backfill for every campaign that now has a ccActivityId.
	 * Safe to re-run: every write is an upsert keyed on the CC id, so nothing
	 * duplicates on a second import. Every DB write is batched (createMany /
	 * chunked transactions), not one row at a time — real accounts can have well
	 * over 100k contacts.
	 */
	async importAll(userId: string | null, onProgress?: ImportProgress) {
		onProgress?.({ phase: "Fetching lists from Constant Contact", completed: 0, total: 0 });
		const segmentIdByCcListId = await importSegments();

		const contacts = await importContacts(segmentIdByCcListId, onProgress);
		const ccSegments = await importCcSegments(onProgress);
		const campaigns = await importCampaigns(onProgress);
		onProgress?.({ phase: "Syncing campaign stats", completed: 0, total: 0 });
		const { syncedCampaigns } = await syncCampaignStats();

		const segments = {
			listsImported: segmentIdByCcListId.size,
			dynamicSegmentsImported: ccSegments.imported,
			dynamicSegmentMemberships: ccSegments.memberships,
		};

		await audit(userId, "connections.import_constant_contact", "connection", {
			...segments,
			contactsCreated: contacts.created,
			contactsUpdated: contacts.updated,
			listSegmentMemberships: contacts.segmentMemberships,
			campaignsCreated: campaigns.created,
			campaignsUpdated: campaigns.updated,
			campaignsSkipped: campaigns.skipped,
			statsSynced: syncedCampaigns,
		});

		return { segments, contacts, campaigns, statsSynced: syncedCampaigns };
	},

	/** Live read-only account info (organization name, timezone, country) for the Connections page. */
	async getAccountInfo() {
		return ccClient.getAccountSummary();
	},
};
