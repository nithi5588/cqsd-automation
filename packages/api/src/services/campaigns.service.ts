import { type Prisma, prisma } from "@cqsd/db";
import { BadRequestError, ConflictError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import { ccClient } from "../infrastructure/integrations";
import type {
	ActivityFilter,
	CreateCampaignInput,
	ListCampaignsQuery,
	UpdateCampaignInput,
} from "../validators/campaigns.validator";
import { audit } from "./audit.service";
import { syncCampaignStats } from "./campaign-sync.service";
import { SegmentsService } from "./segments.service";

const campaignInclude = {
	webinar: { select: { id: true, title: true } },
	segment: { select: { id: true, name: true } },
	stat: true,
} satisfies Prisma.CampaignInclude;

type CampaignWithRelations = Prisma.CampaignGetPayload<{ include: typeof campaignInclude }>;

function toStat(stat: NonNullable<CampaignWithRelations["stat"]>) {
	return {
		sends: stat.sends,
		opens: stat.opens,
		uniqueOpens: stat.uniqueOpens,
		clicks: stat.clicks,
		uniqueClicks: stat.uniqueClicks,
		bounces: stat.bounces,
		optouts: stat.optouts,
		lastSyncedAt: stat.lastSyncedAt,
	};
}

function toCampaignListItem(campaign: CampaignWithRelations) {
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
		stat: campaign.stat ? toStat(campaign.stat) : null,
		createdAt: campaign.createdAt,
	};
}

async function getCampaignOrThrow(id: string): Promise<CampaignWithRelations> {
	const campaign = await prisma.campaign.findUnique({ where: { id }, include: campaignInclude });
	if (!campaign) {
		throw new NotFoundError("Campaign not found");
	}
	return campaign;
}

async function assertWebinarExists(webinarId: string): Promise<void> {
	const count = await prisma.webinar.count({ where: { id: webinarId } });
	if (count === 0) {
		throw new BadRequestError("Webinar not found");
	}
}

async function assertSegmentExists(segmentId: string): Promise<void> {
	const count = await prisma.segment.count({ where: { id: segmentId } });
	if (count === 0) {
		throw new BadRequestError("Segment not found");
	}
}

export const CampaignsService = {
	async list(query: ListCampaignsQuery, pagination: PaginationParams) {
		const where: Prisma.CampaignWhereInput = {};
		if (query.status) {
			where.status = query.status;
		}
		if (query.search) {
			where.OR = [
				{ name: { contains: query.search, mode: "insensitive" } },
				{ subject: { contains: query.search, mode: "insensitive" } },
			];
		}

		const [campaigns, total] = await Promise.all([
			prisma.campaign.findMany({
				where,
				include: campaignInclude,
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
			}),
			prisma.campaign.count({ where }),
		]);

		return {
			items: campaigns.map(toCampaignListItem),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async create(input: CreateCampaignInput) {
		if (input.webinarId) {
			await assertWebinarExists(input.webinarId);
		}
		if (input.segmentId) {
			await assertSegmentExists(input.segmentId);
		}

		const campaign = await prisma.campaign.create({
			data: {
				name: input.name,
				subject: input.subject,
				fromName: input.fromName,
				fromEmail: input.fromEmail.toLowerCase(),
				replyTo: input.replyTo ? input.replyTo.toLowerCase() : null,
				htmlContent: input.htmlContent ?? null,
				templateId: input.templateId ?? null,
				webinarId: input.webinarId ?? null,
				volumeNumber: input.volumeNumber ?? null,
				segmentId: input.segmentId ?? null,
				scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
				status: "DRAFT",
			},
			include: campaignInclude,
		});

		return toCampaignListItem(campaign);
	},

	async getById(id: string) {
		const campaign = await getCampaignOrThrow(id);
		return {
			...toCampaignListItem(campaign),
			htmlContent: campaign.htmlContent,
			templateId: campaign.templateId,
			replyTo: campaign.replyTo,
		};
	},

	async update(id: string, input: UpdateCampaignInput) {
		const existing = await getCampaignOrThrow(id);
		if (existing.status !== "DRAFT") {
			throw new ConflictError("Only draft campaigns can be edited");
		}
		if (input.webinarId) {
			await assertWebinarExists(input.webinarId);
		}
		if (input.segmentId) {
			await assertSegmentExists(input.segmentId);
		}

		const data: Prisma.CampaignUncheckedUpdateInput = {};
		if (input.name !== undefined) data.name = input.name;
		if (input.subject !== undefined) data.subject = input.subject;
		if (input.fromName !== undefined) data.fromName = input.fromName;
		if (input.fromEmail !== undefined) {
			data.fromEmail = input.fromEmail ? input.fromEmail.toLowerCase() : null;
		}
		if (input.replyTo !== undefined) {
			data.replyTo = input.replyTo ? input.replyTo.toLowerCase() : null;
		}
		if (input.htmlContent !== undefined) data.htmlContent = input.htmlContent;
		if (input.templateId !== undefined) data.templateId = input.templateId;
		if (input.webinarId !== undefined) data.webinarId = input.webinarId;
		if (input.volumeNumber !== undefined) data.volumeNumber = input.volumeNumber;
		if (input.segmentId !== undefined) data.segmentId = input.segmentId;
		if (input.scheduledAt !== undefined) {
			data.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
		}

		const campaign = await prisma.campaign.update({
			where: { id },
			data,
			include: campaignInclude,
		});

		return toCampaignListItem(campaign);
	},

	async remove(id: string) {
		const existing = await getCampaignOrThrow(id);
		if (existing.status !== "DRAFT") {
			throw new ConflictError("Only draft campaigns can be deleted");
		}
		await prisma.campaign.delete({ where: { id } });
	},

	async pushToCc(id: string, userId: string | null) {
		const campaign = await prisma.campaign.findUnique({
			where: { id },
			include: { segment: true },
		});
		if (!campaign) {
			throw new NotFoundError("Campaign not found");
		}
		if (campaign.ccActivityId) {
			throw new ConflictError("Campaign has already been pushed to Constant Contact");
		}

		const missing: string[] = [];
		if (!campaign.fromName) missing.push("fromName");
		if (!campaign.fromEmail) missing.push("fromEmail");
		if (!campaign.subject) missing.push("subject");
		if (!campaign.htmlContent) missing.push("htmlContent");
		if (missing.length > 0) {
			throw new BadRequestError(
				`Cannot push to Constant Contact — missing ${missing.join(", ")}. Fill these fields in and try again.`,
			);
		}
		if (!campaign.segment) {
			throw new BadRequestError("Cannot push to Constant Contact — assign a segment to this campaign first.");
		}

		// Never-synced segments are synced automatically here, so pushing a
		// campaign needs no separate "sync the segment" step first.
		let ccSegmentId = campaign.segment.ccSegmentId;
		if (!ccSegmentId) {
			const { ccListId } = await SegmentsService.syncToCc(campaign.segment.id, userId);
			ccSegmentId = ccListId;
		}

		const { campaignId: ccCampaignId, activityId: ccActivityId } = await ccClient.createEmailCampaign({
			name: campaign.name,
			fromName: campaign.fromName as string,
			fromEmail: campaign.fromEmail as string,
			replyTo: (campaign.replyTo ?? campaign.fromEmail) as string,
			subject: campaign.subject,
			htmlContent: campaign.htmlContent as string,
		});
		await ccClient.setActivityLists(ccActivityId, [ccSegmentId]);

		const updated = await prisma.campaign.update({
			where: { id },
			data: { ccCampaignId, ccActivityId },
			include: campaignInclude,
		});

		await audit(userId, "campaign.push-to-cc", "campaign", {
			campaignId: id,
			ccCampaignId,
			ccActivityId,
		});

		return toCampaignListItem(updated);
	},

	async sendTest(id: string, emails: string[]) {
		const campaign = await getCampaignOrThrow(id);
		if (!campaign.ccActivityId) {
			throw new BadRequestError("Push to Constant Contact first");
		}
		await ccClient.sendTest(
			campaign.ccActivityId,
			emails.map((email) => email.toLowerCase()),
		);
	},

	async schedule(id: string, scheduledAtIso: string, userId: string | null) {
		const campaign = await getCampaignOrThrow(id);
		if (!campaign.ccActivityId) {
			throw new BadRequestError("Push to Constant Contact first");
		}

		const scheduledAt = new Date(scheduledAtIso);
		await ccClient.scheduleActivity(campaign.ccActivityId, scheduledAt.toISOString());

		const updated = await prisma.campaign.update({
			where: { id },
			data: { status: "SCHEDULED", scheduledAt },
			include: campaignInclude,
		});

		await audit(userId, "campaign.schedule", "campaign", {
			campaignId: id,
			scheduledAt: scheduledAt.toISOString(),
		});

		return toCampaignListItem(updated);
	},

	async unschedule(id: string) {
		const campaign = await getCampaignOrThrow(id);
		if (!campaign.ccActivityId) {
			throw new BadRequestError("Push to Constant Contact first");
		}

		await ccClient.unscheduleActivity(campaign.ccActivityId);

		const updated = await prisma.campaign.update({
			where: { id },
			data: { status: "DRAFT", scheduledAt: null },
			include: campaignInclude,
		});

		return toCampaignListItem(updated);
	},

	async syncStats(id: string) {
		const campaign = await getCampaignOrThrow(id);
		if (!campaign.ccActivityId) {
			throw new BadRequestError("Push to Constant Contact first");
		}

		await syncCampaignStats(id);

		const stat = await prisma.campaignStat.findUnique({ where: { campaignId: id } });
		return stat ? toStat(stat) : null;
	},

	async activity(
		id: string,
		filter: ActivityFilter,
		search: string | undefined,
		pagination: PaginationParams,
	) {
		await getCampaignOrThrow(id);

		const where: Prisma.ContactCampaignActivityWhereInput = { campaignId: id };
		if (filter === "opened") {
			where.opened = true;
		}
		if (filter === "clicked") {
			where.clicked = true;
		}
		if (search) {
			where.contact = {
				OR: [
					{ firstName: { contains: search, mode: "insensitive" } },
					{ lastName: { contains: search, mode: "insensitive" } },
					{ email: { contains: search, mode: "insensitive" } },
				],
			};
		}

		const [rows, total] = await Promise.all([
			prisma.contactCampaignActivity.findMany({
				where,
				include: {
					contact: { include: { organization: { select: { id: true, name: true } } } },
				},
				orderBy: [{ clicked: "desc" }, { opened: "desc" }, { openCount: "desc" }],
				skip: pagination.skip,
				take: pagination.take,
			}),
			prisma.contactCampaignActivity.count({ where }),
		]);

		return {
			items: rows.map((row) => ({
				contactId: row.contactId,
				firstName: row.contact.firstName,
				lastName: row.contact.lastName,
				email: row.contact.email,
				title: row.contact.title,
				persona: row.contact.persona,
				organization: row.contact.organization
					? { id: row.contact.organization.id, name: row.contact.organization.name }
					: null,
				opened: row.opened,
				clicked: row.clicked,
				openCount: row.openCount,
				clickCount: row.clickCount,
				firstOpenAt: row.firstOpenAt,
				firstClickAt: row.firstClickAt,
			})),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async activityByCompany(id: string) {
		await getCampaignOrThrow(id);

		const rows = await prisma.contactCampaignActivity.findMany({
			where: { campaignId: id },
			include: {
				contact: {
					select: { orgId: true, organization: { select: { id: true, name: true } } },
				},
			},
		});

		const groups = new Map<
			string,
			{
				orgId: string | null;
				orgName: string;
				contacts: number;
				opened: number;
				clicked: number;
				openCount: number;
				clickCount: number;
			}
		>();

		for (const row of rows) {
			const key = row.contact.orgId ?? "__no_company__";
			let group = groups.get(key);
			if (!group) {
				group = {
					orgId: row.contact.orgId,
					orgName: row.contact.organization?.name ?? "No company",
					contacts: 0,
					opened: 0,
					clicked: 0,
					openCount: 0,
					clickCount: 0,
				};
				groups.set(key, group);
			}
			group.contacts += 1;
			if (row.opened) group.opened += 1;
			if (row.clicked) group.clicked += 1;
			group.openCount += row.openCount;
			group.clickCount += row.clickCount;
		}

		const items = [...groups.values()].sort((a, b) => b.clicked - a.clicked || b.opened - a.opened);

		return { items };
	},
};
