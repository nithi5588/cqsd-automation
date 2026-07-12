import { type Campaign, type CampaignStat, prisma } from "@cqsd/db";
import { tokenStore } from "../infrastructure/integrations";
import { mapCampaignStat, toWebinarListItem } from "./webinars.service";

const DAY_MS = 86_400_000;

type CampaignWithRefs = Campaign & {
	webinar: { id: string; title: string } | null;
	segment: { id: string; name: string } | null;
	stat: CampaignStat | null;
};

function toCampaignListItem(campaign: CampaignWithRefs) {
	return {
		id: campaign.id,
		name: campaign.name,
		subject: campaign.subject,
		status: campaign.status,
		volumeNumber: campaign.volumeNumber,
		scheduledAt: campaign.scheduledAt,
		fromName: campaign.fromName,
		fromEmail: campaign.fromEmail,
		webinar: campaign.webinar ? { id: campaign.webinar.id, title: campaign.webinar.title } : null,
		segment: campaign.segment ? { id: campaign.segment.id, name: campaign.segment.name } : null,
		ccCampaignId: campaign.ccCampaignId,
		ccActivityId: campaign.ccActivityId,
		stat: campaign.stat ? mapCampaignStat(campaign.stat) : null,
		createdAt: campaign.createdAt,
	};
}

const PERSONA_ORDER = ["IT", "LINE_OF_BUSINESS", "CUSTOMER_SERVICE", "UNKNOWN"] as const;

export const OverviewService = {
	async get() {
		const now = new Date();
		const upcomingWhere = { startsAt: { gt: now }, status: { not: "CANCELED" as const } };
		const trendStart = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS - 29 * DAY_MS);

		const [
			contacts,
			organizations,
			campaignsSent,
			statTotals,
			upcomingWebinarCount,
			attendeeEmailRows,
			ccStatus,
			msStatus,
			recentCampaignRows,
			upcomingWebinarRows,
			engagedActivityRows,
			trendRows,
			registrationCount,
			performanceRows,
			showRateRows,
			personaRows,
			draftCampaigns,
			scheduledCampaigns,
			nextScheduledAgg,
			completedWebinarsWithoutAttendance,
			bouncedContacts,
			recentActivityRows,
		] = await Promise.all([
			prisma.contact.count(),
			prisma.organization.count(),
			prisma.campaign.count({ where: { status: "SENT" } }),
			prisma.campaignStat.aggregate({
				_sum: { sends: true, uniqueOpens: true, uniqueClicks: true },
			}),
			prisma.webinar.count({ where: upcomingWhere }),
			prisma.attendance.findMany({
				where: { attended: true },
				select: { email: true },
				distinct: ["email"],
			}),
			tokenStore.status("CONSTANT_CONTACT"),
			tokenStore.status("MICROSOFT"),
			prisma.campaign.findMany({
				orderBy: { createdAt: "desc" },
				take: 5,
				include: {
					webinar: { select: { id: true, title: true } },
					segment: { select: { id: true, name: true } },
					stat: true,
				},
			}),
			prisma.webinar.findMany({
				where: upcomingWhere,
				orderBy: { startsAt: "asc" },
				take: 5,
				include: { _count: { select: { registrations: true, attendances: true } } },
			}),
			prisma.contactCampaignActivity.findMany({
				where: {
					OR: [{ opened: true }, { clicked: true }],
					contact: { orgId: { not: null } },
				},
				select: {
					opened: true,
					clicked: true,
					contact: { select: { orgId: true, organization: { select: { name: true } } } },
				},
			}),
			prisma.contactCampaignActivity.findMany({
				where: { firstOpenAt: { gte: trendStart } },
				select: { firstOpenAt: true, opened: true, clicked: true },
			}),
			prisma.registration.count(),
			prisma.campaign.findMany({
				where: { status: "SENT", stat: { is: { sends: { gt: 0 } } } },
				select: {
					id: true,
					name: true,
					volumeNumber: true,
					scheduledAt: true,
					createdAt: true,
					stat: { select: { sends: true, uniqueOpens: true, uniqueClicks: true } },
				},
			}),
			prisma.webinar.findMany({
				where: { registrations: { some: {} } },
				orderBy: { startsAt: "desc" },
				take: 5,
				select: {
					id: true,
					title: true,
					startsAt: true,
					_count: {
						select: {
							registrations: true,
							attendances: { where: { attended: true } },
						},
					},
				},
			}),
			prisma.contact.groupBy({ by: ["persona"], _count: { _all: true } }),
			prisma.campaign.count({ where: { status: "DRAFT" } }),
			prisma.campaign.count({ where: { status: "SCHEDULED" } }),
			prisma.campaign.aggregate({
				where: { status: "SCHEDULED", scheduledAt: { gt: now } },
				_min: { scheduledAt: true },
			}),
			prisma.webinar.count({ where: { status: "COMPLETED", attendances: { none: {} } } }),
			prisma.contact.count({ where: { bouncedAt: { not: null } } }),
			prisma.auditLog.findMany({
				orderBy: { createdAt: "desc" },
				take: 6,
				select: {
					id: true,
					action: true,
					entity: true,
					createdAt: true,
					user: { select: { email: true } },
				},
			}),
		]);

		// Unique people, not attendance rows — dedupe case-insensitively on email.
		const totalAttendees = new Set(attendeeEmailRows.map((row) => row.email.toLowerCase())).size;

		const totalSends = statTotals._sum.sends ?? 0;
		const avgOpenRate = totalSends > 0 ? (statTotals._sum.uniqueOpens ?? 0) / totalSends : null;
		const avgClickRate = totalSends > 0 ? (statTotals._sum.uniqueClicks ?? 0) / totalSends : null;

		const companies = new Map<
			string,
			{ orgId: string; name: string; uniqueOpens: number; uniqueClicks: number }
		>();
		for (const row of engagedActivityRows) {
			const orgId = row.contact.orgId;
			if (!orgId) continue;
			let entry = companies.get(orgId);
			if (!entry) {
				entry = {
					orgId,
					name: row.contact.organization?.name ?? "Unknown",
					uniqueOpens: 0,
					uniqueClicks: 0,
				};
				companies.set(orgId, entry);
			}
			if (row.opened) entry.uniqueOpens += 1;
			if (row.clicked) entry.uniqueClicks += 1;
		}
		const topCompanies = [...companies.values()]
			.sort((a, b) => b.uniqueClicks - a.uniqueClicks || b.uniqueOpens - a.uniqueOpens)
			.slice(0, 5);

		const buckets = new Map<string, { opens: number; clicks: number }>();
		for (let day = 0; day < 30; day += 1) {
			const date = new Date(trendStart.getTime() + day * DAY_MS).toISOString().slice(0, 10);
			buckets.set(date, { opens: 0, clicks: 0 });
		}
		for (const row of trendRows) {
			if (!row.firstOpenAt) continue;
			const bucket = buckets.get(row.firstOpenAt.toISOString().slice(0, 10));
			if (!bucket) continue;
			if (row.opened) bucket.opens += 1;
			if (row.clicked) bucket.clicks += 1;
		}
		const engagementTrend = [...buckets.entries()].map(([date, counts]) => ({
			date,
			opens: counts.opens,
			clicks: counts.clicks,
		}));

		const funnel = {
			sends: totalSends,
			uniqueOpens: statTotals._sum.uniqueOpens ?? 0,
			uniqueClicks: statTotals._sum.uniqueClicks ?? 0,
			registrations: registrationCount,
			attendees: totalAttendees,
		};

		// Chronological by send time (scheduledAt, falling back to createdAt), last 6.
		const sentAt = (row: { scheduledAt: Date | null; createdAt: Date }) =>
			(row.scheduledAt ?? row.createdAt).getTime();
		const campaignPerformance = [...performanceRows]
			.sort((a, b) => sentAt(a) - sentAt(b))
			.slice(-6)
			.map((row) => {
				const sends = row.stat?.sends ?? 0;
				return {
					campaignId: row.id,
					name: row.name,
					volumeNumber: row.volumeNumber,
					sends,
					openRate: sends > 0 ? (row.stat?.uniqueOpens ?? 0) / sends : null,
					clickRate: sends > 0 ? (row.stat?.uniqueClicks ?? 0) / sends : null,
				};
			});

		// Queried newest-first to grab the last 5; reversed back into startsAt ASC.
		const webinarShowRates = [...showRateRows].reverse().map((row) => ({
			webinarId: row.id,
			title: row.title,
			startsAt: row.startsAt.toISOString(),
			registrations: row._count.registrations,
			attended: row._count.attendances,
		}));

		const personaCounts = new Map<(typeof PERSONA_ORDER)[number], number>();
		for (const row of personaRows) {
			personaCounts.set(row.persona ?? "UNKNOWN", row._count._all);
		}
		const personas = PERSONA_ORDER.map((persona) => ({
			persona,
			contacts: personaCounts.get(persona) ?? 0,
		}));

		const attention = {
			draftCampaigns,
			scheduledCampaigns,
			nextScheduledAt: nextScheduledAgg._min.scheduledAt?.toISOString() ?? null,
			completedWebinarsWithoutAttendance,
			bouncedContacts,
		};

		const recentActivity = recentActivityRows.map((row) => ({
			id: row.id,
			action: row.action,
			entity: row.entity,
			userEmail: row.user?.email ?? null,
			createdAt: row.createdAt.toISOString(),
		}));

		return {
			kpis: {
				contacts,
				organizations,
				campaignsSent,
				avgOpenRate,
				avgClickRate,
				upcomingWebinars: upcomingWebinarCount,
				totalAttendees,
				ccConnected: ccStatus.connected,
				msConnected: msStatus.connected,
			},
			recentCampaigns: recentCampaignRows.map(toCampaignListItem),
			upcomingWebinars: upcomingWebinarRows.map(toWebinarListItem),
			topCompanies,
			engagementTrend,
			funnel,
			campaignPerformance,
			webinarShowRates,
			personas,
			attention,
			recentActivity,
		};
	},
};
