import { type CampaignStatus, prisma } from "@cqsd/db";
import { isHardBounce } from "@cqsd/integrations";
import { BadRequestError } from "@cqsd/shared/http";
import { ccClient } from "../infrastructure/integrations";

/** Seeded demo campaigns carry fake ccActivityId values with this prefix (see packages/db/src/seed.ts). */
const SEED_ID_PREFIX = "seed-";

interface TrackingRow {
	contactId: string;
	email: string;
	createdTime: string | null;
	count: number;
}

interface SyncTarget {
	id: string;
	ccActivityId: string;
	scheduledAt: Date | null;
	status: CampaignStatus;
}

/**
 * Builds a lookup that resolves a Constant Contact tracking row to a local
 * Contact id — matching by ccContactId first, then by lowercased email.
 */
async function buildContactResolver(rows: TrackingRow[]): Promise<(row: TrackingRow) => string | null> {
	const ccIds = [
		...new Set(rows.map((row) => row.contactId).filter((value): value is string => Boolean(value))),
	];
	const emails = [
		...new Set(
			rows.map((row) => row.email?.toLowerCase()).filter((value): value is string => Boolean(value)),
		),
	];
	if (ccIds.length === 0 && emails.length === 0) {
		return () => null;
	}

	const contacts = await prisma.contact.findMany({
		where: {
			OR: [
				...(ccIds.length > 0 ? [{ ccContactId: { in: ccIds } }] : []),
				...(emails.length > 0 ? [{ email: { in: emails } }] : []),
			],
		},
		select: { id: true, email: true, ccContactId: true },
	});

	const byCcId = new Map<string, string>();
	const byEmail = new Map<string, string>();
	for (const contact of contacts) {
		if (contact.ccContactId) {
			byCcId.set(contact.ccContactId, contact.id);
		}
		byEmail.set(contact.email.toLowerCase(), contact.id);
	}

	return (row) => {
		if (row.contactId) {
			const matched = byCcId.get(row.contactId);
			if (matched) return matched;
		}
		if (row.email) {
			const matched = byEmail.get(row.email.toLowerCase());
			if (matched) return matched;
		}
		return null;
	};
}

/** Aggregates tracking rows per resolved contact (sums counts, keeps the earliest timestamp). */
function aggregateByContact(
	rows: TrackingRow[],
	resolve: (row: TrackingRow) => string | null,
): Map<string, { count: number; earliest: Date | null }> {
	const map = new Map<string, { count: number; earliest: Date | null }>();
	for (const row of rows) {
		const contactId = resolve(row);
		if (!contactId) continue;
		const time = row.createdTime ? new Date(row.createdTime) : null;
		const existing = map.get(contactId);
		if (!existing) {
			map.set(contactId, { count: row.count, earliest: time });
		} else {
			existing.count += row.count;
			if (time && (!existing.earliest || time < existing.earliest)) {
				existing.earliest = time;
			}
		}
	}
	return map;
}

async function syncOneCampaign(campaign: SyncTarget): Promise<void> {
	const activityId = campaign.ccActivityId;
	const now = new Date();

	const stats = await ccClient.getActivityStats(activityId);
	await prisma.campaignStat.upsert({
		where: { campaignId: campaign.id },
		create: {
			campaignId: campaign.id,
			sends: stats.sends,
			opens: stats.opens,
			uniqueOpens: stats.uniqueOpens,
			clicks: stats.clicks,
			uniqueClicks: stats.uniqueClicks,
			bounces: stats.bounces,
			optouts: stats.optouts,
			lastSyncedAt: now,
		},
		update: {
			sends: stats.sends,
			opens: stats.opens,
			uniqueOpens: stats.uniqueOpens,
			clicks: stats.clicks,
			uniqueClicks: stats.uniqueClicks,
			bounces: stats.bounces,
			optouts: stats.optouts,
			lastSyncedAt: now,
		},
	});

	const [opens, clicks, bounces] = await Promise.all([
		ccClient.getUniqueOpens(activityId),
		ccClient.getClicks(activityId),
		ccClient.getBounces(activityId),
	]);

	const resolve = await buildContactResolver([...opens, ...clicks, ...bounces]);

	const openByContact = aggregateByContact(opens, resolve);
	for (const [contactId, agg] of openByContact) {
		await prisma.contactCampaignActivity.upsert({
			where: { contactId_campaignId: { contactId, campaignId: campaign.id } },
			create: {
				contactId,
				campaignId: campaign.id,
				opened: true,
				openCount: agg.count,
				firstOpenAt: agg.earliest,
			},
			update: {
				opened: true,
				openCount: agg.count,
				...(agg.earliest ? { firstOpenAt: agg.earliest } : {}),
			},
		});
	}

	const clickByContact = aggregateByContact(clicks, resolve);
	for (const [contactId, agg] of clickByContact) {
		await prisma.contactCampaignActivity.upsert({
			where: { contactId_campaignId: { contactId, campaignId: campaign.id } },
			create: {
				contactId,
				campaignId: campaign.id,
				clicked: true,
				clickCount: agg.count,
				firstClickAt: agg.earliest,
			},
			update: {
				clicked: true,
				clickCount: agg.count,
				...(agg.earliest ? { firstClickAt: agg.earliest } : {}),
			},
		});
	}

	const hardBouncedContactIds = new Set<string>();
	for (const row of bounces) {
		if (!isHardBounce(row.bounceCode)) continue;
		const contactId = resolve(row);
		if (contactId) {
			hardBouncedContactIds.add(contactId);
		}
	}
	if (hardBouncedContactIds.size > 0) {
		await prisma.segmentMember.deleteMany({
			where: { contactId: { in: [...hardBouncedContactIds] } },
		});
		// Flag the contacts as bounced so re-materialization and CC pushes skip
		// them — keeping the earliest bounce timestamp when one is already set.
		await prisma.contact.updateMany({
			where: { id: { in: [...hardBouncedContactIds] }, bouncedAt: null },
			data: { bouncedAt: new Date() },
		});
	}

	if (
		campaign.status !== "SENT" &&
		campaign.scheduledAt &&
		campaign.scheduledAt.getTime() < Date.now() &&
		stats.sends > 0
	) {
		await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SENT" } });
	}
}

/**
 * Pulls Constant Contact tracking data into CampaignStat + ContactCampaignActivity.
 * With a campaignId, syncs just that campaign (errors propagate to the caller);
 * without one, syncs every pushed campaign in SCHEDULED/SENDING/SENT and logs
 * per-campaign failures without aborting the batch.
 */
export async function syncCampaignStats(campaignId?: string): Promise<{ syncedCampaigns: number }> {
	const campaigns = await prisma.campaign.findMany({
		where: campaignId
			? { id: campaignId, ccActivityId: { not: null } }
			: {
					ccActivityId: { not: null },
					status: { in: ["SCHEDULED", "SENDING", "SENT"] },
					// Seeded demo campaigns carry fake activity ids — never send those to Constant Contact.
					NOT: { ccActivityId: { startsWith: SEED_ID_PREFIX } },
				},
		select: { id: true, ccActivityId: true, scheduledAt: true, status: true },
	});

	let syncedCampaigns = 0;
	for (const campaign of campaigns) {
		if (!campaign.ccActivityId) continue;
		if (campaign.ccActivityId.startsWith(SEED_ID_PREFIX)) {
			if (campaignId) {
				throw new BadRequestError(
					"This is seeded demo data — create a real campaign to sync stats from Constant Contact",
				);
			}
			continue;
		}
		try {
			await syncOneCampaign({
				id: campaign.id,
				ccActivityId: campaign.ccActivityId,
				scheduledAt: campaign.scheduledAt,
				status: campaign.status,
			});
			syncedCampaigns += 1;
		} catch (error) {
			if (campaignId) {
				throw error;
			}
			console.error(`[campaign-sync] Failed to sync campaign ${campaign.id}:`, error);
		}
	}

	return { syncedCampaigns };
}
