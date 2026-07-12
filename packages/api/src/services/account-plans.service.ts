import { type Persona, type Prisma, prisma } from "@cqsd/db";
import { NotFoundError, type PaginationParams } from "@cqsd/shared/http";

interface PlanContact {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	title: string | null;
	persona: Persona | null;
}

interface PlanActivityRow {
	contactId: string;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	firstOpenAt: Date | null;
}

interface PlanAttendanceRow {
	contactId: string | null;
	attended: boolean;
	durationSeconds: number;
	joinTime: Date | null;
}

interface ContactAggregate {
	sent: number;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	webinarsAttended: number;
	totalAttendedSeconds: number;
	lastEngagedAt: Date | null;
}

const planContactSelect = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	title: true,
	persona: true,
} as const;

function laterDate(current: Date | null, candidate: Date | null): Date | null {
	if (!candidate) return current;
	if (!current || candidate.getTime() > current.getTime()) return candidate;
	return current;
}

/**
 * Shared aggregation core for org-scoped and webinar-scoped account plans:
 * folds raw activity + attendance rows into per-contact rows, persona
 * breakdown, and engagement totals — all in memory, from batched queries.
 */
function buildPlanCore(
	contacts: PlanContact[],
	activities: PlanActivityRow[],
	attendances: PlanAttendanceRow[],
) {
	const byContact = new Map<string, ContactAggregate>();
	const ensure = (contactId: string): ContactAggregate => {
		let aggregate = byContact.get(contactId);
		if (!aggregate) {
			aggregate = {
				sent: 0,
				opened: false,
				clicked: false,
				openCount: 0,
				clickCount: 0,
				webinarsAttended: 0,
				totalAttendedSeconds: 0,
				lastEngagedAt: null,
			};
			byContact.set(contactId, aggregate);
		}
		return aggregate;
	};

	for (const row of activities) {
		const aggregate = ensure(row.contactId);
		aggregate.sent += 1;
		aggregate.opened = aggregate.opened || row.opened;
		aggregate.clicked = aggregate.clicked || row.clicked;
		aggregate.openCount += row.openCount;
		aggregate.clickCount += row.clickCount;
		aggregate.lastEngagedAt = laterDate(aggregate.lastEngagedAt, row.firstOpenAt);
	}

	for (const row of attendances) {
		if (!row.contactId) continue;
		const aggregate = ensure(row.contactId);
		if (row.attended) aggregate.webinarsAttended += 1;
		aggregate.totalAttendedSeconds += row.durationSeconds;
		aggregate.lastEngagedAt = laterDate(aggregate.lastEngagedAt, row.joinTime);
	}

	const personaCounts = new Map<string, number>();
	for (const contact of contacts) {
		const key = contact.persona ?? "UNKNOWN";
		personaCounts.set(key, (personaCounts.get(key) ?? 0) + 1);
	}

	const contactRows = contacts.map((contact) => {
		const aggregate = byContact.get(contact.id);
		return {
			contactId: contact.id,
			name: `${contact.firstName} ${contact.lastName}`.trim(),
			email: contact.email,
			title: contact.title,
			persona: contact.persona,
			sent: aggregate?.sent ?? 0,
			opened: aggregate?.opened ?? false,
			clicked: aggregate?.clicked ?? false,
			openCount: aggregate?.openCount ?? 0,
			clickCount: aggregate?.clickCount ?? 0,
			webinarsAttended: aggregate?.webinarsAttended ?? 0,
			totalAttendedSeconds: aggregate?.totalAttendedSeconds ?? 0,
			lastEngagedAt: aggregate?.lastEngagedAt ?? null,
		};
	});

	const matchedAttendances = attendances.filter((row) => row.contactId);
	const totals = {
		contacts: contacts.length,
		emailsSent: activities.length,
		opens: activities.reduce((sum, row) => sum + row.openCount, 0),
		uniqueOpens: activities.filter((row) => row.opened).length,
		clicks: activities.reduce((sum, row) => sum + row.clickCount, 0),
		uniqueClicks: activities.filter((row) => row.clicked).length,
		webinarsAttended: matchedAttendances.filter((row) => row.attended).length,
		attendedSeconds: matchedAttendances.reduce((sum, row) => sum + row.durationSeconds, 0),
	};

	const personas = [...personaCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.map(([persona, count]) => ({ persona, contacts: count }));

	return { personas, totals, contacts: contactRows };
}

function kebabCase(input: string): string {
	return input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function escapeCsv(value: string): string {
	if (/[",\r\n]/.test(value)) {
		return `"${value.replaceAll('"', '""')}"`;
	}
	return value;
}

export const AccountPlansService = {
	async list(query: { search?: string }, pagination: PaginationParams) {
		const where: Prisma.OrganizationWhereInput = query.search
			? { name: { contains: query.search, mode: "insensitive" } }
			: {};

		const [total, organizations] = await Promise.all([
			prisma.organization.count({ where }),
			prisma.organization.findMany({
				where,
				orderBy: { name: "asc" },
				skip: pagination.skip,
				take: pagination.take,
			}),
		]);
		const orgIds = organizations.map((org) => org.id);

		const [contactCounts, activityRows, attendanceRows] = await Promise.all([
			prisma.contact.groupBy({
				by: ["orgId"],
				where: { orgId: { in: orgIds } },
				_count: true,
			}),
			prisma.contactCampaignActivity.findMany({
				where: { contact: { orgId: { in: orgIds } } },
				select: {
					opened: true,
					clicked: true,
					firstOpenAt: true,
					contact: { select: { orgId: true } },
				},
			}),
			prisma.attendance.findMany({
				where: { contact: { orgId: { in: orgIds } } },
				select: { attended: true, joinTime: true, contact: { select: { orgId: true } } },
			}),
		]);

		const contactCountByOrg = new Map(
			contactCounts.flatMap((row) => (row.orgId ? [[row.orgId, row._count] as const] : [])),
		);

		interface OrgAggregate {
			emailsSent: number;
			uniqueOpens: number;
			uniqueClicks: number;
			attendees: number;
			lastActivityAt: Date | null;
		}
		const aggregates = new Map<string, OrgAggregate>();
		const ensure = (orgId: string): OrgAggregate => {
			let aggregate = aggregates.get(orgId);
			if (!aggregate) {
				aggregate = {
					emailsSent: 0,
					uniqueOpens: 0,
					uniqueClicks: 0,
					attendees: 0,
					lastActivityAt: null,
				};
				aggregates.set(orgId, aggregate);
			}
			return aggregate;
		};

		for (const row of activityRows) {
			const orgId = row.contact?.orgId;
			if (!orgId) continue;
			const aggregate = ensure(orgId);
			aggregate.emailsSent += 1;
			if (row.opened) aggregate.uniqueOpens += 1;
			if (row.clicked) aggregate.uniqueClicks += 1;
			aggregate.lastActivityAt = laterDate(aggregate.lastActivityAt, row.firstOpenAt);
		}
		for (const row of attendanceRows) {
			const orgId = row.contact?.orgId;
			if (!orgId) continue;
			const aggregate = ensure(orgId);
			if (row.attended) aggregate.attendees += 1;
			aggregate.lastActivityAt = laterDate(aggregate.lastActivityAt, row.joinTime);
		}

		return {
			items: organizations.map((org) => {
				const aggregate = aggregates.get(org.id);
				const emailsSent = aggregate?.emailsSent ?? 0;
				const uniqueOpens = aggregate?.uniqueOpens ?? 0;
				const uniqueClicks = aggregate?.uniqueClicks ?? 0;
				return {
					orgId: org.id,
					name: org.name,
					industry: org.industry,
					aeOwner: org.aeOwner,
					contacts: contactCountByOrg.get(org.id) ?? 0,
					emailsSent,
					uniqueOpens,
					uniqueClicks,
					attendees: aggregate?.attendees ?? 0,
					openRate: emailsSent > 0 ? uniqueOpens / emailsSent : 0,
					clickRate: emailsSent > 0 ? uniqueClicks / emailsSent : 0,
					lastActivityAt: aggregate?.lastActivityAt ?? null,
				};
			}),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async detail(orgId: string) {
		const organization = await prisma.organization.findUnique({ where: { id: orgId } });
		if (!organization) throw new NotFoundError("Organization not found");

		const contacts = await prisma.contact.findMany({
			where: { orgId },
			orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
			select: planContactSelect,
		});
		const contactIds = contacts.map((contact) => contact.id);

		const [activities, attendances, registrations] = await Promise.all([
			prisma.contactCampaignActivity.findMany({
				where: { contactId: { in: contactIds } },
				select: {
					contactId: true,
					opened: true,
					clicked: true,
					openCount: true,
					clickCount: true,
					firstOpenAt: true,
					campaign: {
						select: { id: true, name: true, subject: true, status: true, stat: true },
					},
				},
			}),
			prisma.attendance.findMany({
				where: { contactId: { in: contactIds } },
				select: {
					contactId: true,
					attended: true,
					durationSeconds: true,
					joinTime: true,
					webinar: { select: { id: true, title: true, startsAt: true } },
				},
			}),
			prisma.registration.findMany({
				where: { contactId: { in: contactIds } },
				select: { webinar: { select: { id: true, title: true, startsAt: true } } },
			}),
		]);

		const core = buildPlanCore(contacts, activities, attendances);

		const campaignsById = new Map<
			string,
			{
				campaignId: string;
				name: string;
				subject: string;
				status: string;
				sends: number;
				uniqueOpens: number;
				uniqueClicks: number;
			}
		>();
		for (const row of activities) {
			if (campaignsById.has(row.campaign.id)) continue;
			campaignsById.set(row.campaign.id, {
				campaignId: row.campaign.id,
				name: row.campaign.name,
				subject: row.campaign.subject,
				status: row.campaign.status,
				sends: row.campaign.stat?.sends ?? 0,
				uniqueOpens: row.campaign.stat?.uniqueOpens ?? 0,
				uniqueClicks: row.campaign.stat?.uniqueClicks ?? 0,
			});
		}

		const webinarsById = new Map<
			string,
			{ webinarId: string; title: string; startsAt: Date; registered: number; attended: number }
		>();
		const ensureWebinar = (webinar: { id: string; title: string; startsAt: Date }) => {
			let row = webinarsById.get(webinar.id);
			if (!row) {
				row = {
					webinarId: webinar.id,
					title: webinar.title,
					startsAt: webinar.startsAt,
					registered: 0,
					attended: 0,
				};
				webinarsById.set(webinar.id, row);
			}
			return row;
		};
		for (const registration of registrations) {
			ensureWebinar(registration.webinar).registered += 1;
		}
		for (const attendance of attendances) {
			const row = ensureWebinar(attendance.webinar);
			if (attendance.attended) row.attended += 1;
		}

		return {
			organization: {
				id: organization.id,
				name: organization.name,
				industry: organization.industry,
				revenue: organization.revenue === null ? null : organization.revenue.toNumber(),
				aeOwner: organization.aeOwner,
			},
			personas: core.personas,
			totals: core.totals,
			contacts: core.contacts,
			campaigns: [...campaignsById.values()],
			webinars: [...webinarsById.values()].sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
		};
	},

	async webinarPlan(webinarId: string) {
		const webinar = await prisma.webinar.findUnique({
			where: { id: webinarId },
			select: {
				id: true,
				title: true,
				startsAt: true,
				campaigns: {
					orderBy: { createdAt: "asc" },
					select: { id: true, name: true, subject: true, status: true, stat: true },
				},
			},
		});
		if (!webinar) throw new NotFoundError("Webinar not found");
		const campaignIds = webinar.campaigns.map((campaign) => campaign.id);

		const [registrations, attendances, activities] = await Promise.all([
			prisma.registration.findMany({
				where: { webinarId },
				select: { contactId: true },
			}),
			prisma.attendance.findMany({
				where: { webinarId },
				select: { contactId: true, attended: true, durationSeconds: true, joinTime: true },
			}),
			prisma.contactCampaignActivity.findMany({
				where: { campaignId: { in: campaignIds } },
				select: {
					contactId: true,
					opened: true,
					clicked: true,
					openCount: true,
					clickCount: true,
					firstOpenAt: true,
				},
			}),
		]);

		const contactIds = [
			...new Set([
				...registrations.flatMap((row) => (row.contactId ? [row.contactId] : [])),
				...attendances.flatMap((row) => (row.contactId ? [row.contactId] : [])),
				...activities.map((row) => row.contactId),
			]),
		];
		const contacts = contactIds.length
			? await prisma.contact.findMany({
					where: { id: { in: contactIds } },
					orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
					select: planContactSelect,
				})
			: [];

		const core = buildPlanCore(contacts, activities, attendances);

		return {
			webinar: { id: webinar.id, title: webinar.title },
			personas: core.personas,
			totals: core.totals,
			contacts: core.contacts,
			campaigns: webinar.campaigns.map((campaign) => ({
				campaignId: campaign.id,
				name: campaign.name,
				subject: campaign.subject,
				status: campaign.status,
				sends: campaign.stat?.sends ?? 0,
				uniqueOpens: campaign.stat?.uniqueOpens ?? 0,
				uniqueClicks: campaign.stat?.uniqueClicks ?? 0,
			})),
			webinars: [
				{
					webinarId: webinar.id,
					title: webinar.title,
					startsAt: webinar.startsAt,
					registered: registrations.length,
					attended: attendances.filter((row) => row.attended).length,
				},
			],
		};
	},

	async exportCsv(orgId: string) {
		const plan = await AccountPlansService.detail(orgId);

		const header = [
			"contactId",
			"name",
			"email",
			"title",
			"persona",
			"sent",
			"opened",
			"clicked",
			"openCount",
			"clickCount",
			"webinarsAttended",
			"totalAttendedSeconds",
			"lastEngagedAt",
		];
		const lines = [header.join(",")];
		for (const row of plan.contacts) {
			lines.push(
				[
					row.contactId,
					row.name,
					row.email,
					row.title ?? "",
					row.persona ?? "",
					String(row.sent),
					String(row.opened),
					String(row.clicked),
					String(row.openCount),
					String(row.clickCount),
					String(row.webinarsAttended),
					String(row.totalAttendedSeconds),
					row.lastEngagedAt ? row.lastEngagedAt.toISOString() : "",
				]
					.map(escapeCsv)
					.join(","),
			);
		}

		const slug = kebabCase(plan.organization.name) || plan.organization.id;
		return { fileName: `account-plan-${slug}.csv`, csv: `${lines.join("\r\n")}\r\n` };
	},
};
