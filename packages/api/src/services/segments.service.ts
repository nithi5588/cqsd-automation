import { type Prisma, type Segment, prisma } from "@cqsd/db";
import { BadRequestError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import { ccClient } from "../infrastructure/integrations";
import type {
	AddSegmentMembersInput,
	CreateSegmentInput,
	SegmentCriteria,
	UpdateSegmentInput,
} from "../validators/segments.validator";
import { audit } from "./audit.service";
import { toContactListItem } from "./contacts.service";
import { materializeSegment } from "./segment-membership";

const organizationSelect = { select: { id: true, name: true } } as const;

/** Drops undefined keys so criteria stored as JSON stays clean and comparable. */
function cleanCriteria(criteria: SegmentCriteria): Prisma.InputJsonObject {
	const clean: Record<string, string | boolean> = {};
	if (criteria.all === true) {
		clean.all = true;
	}
	if (criteria.industry !== undefined) {
		clean.industry = criteria.industry;
	}
	if (criteria.aeOwner !== undefined) {
		clean.aeOwner = criteria.aeOwner;
	}
	if (criteria.persona !== undefined) {
		clean.persona = criteria.persona;
	}
	return clean;
}

function toSegmentItem(segment: Segment, memberCount: number) {
	return {
		id: segment.id,
		name: segment.name,
		type: segment.type,
		criteria: (segment.criteriaJson ?? {}) as SegmentCriteria,
		memberCount,
		ccSegmentId: segment.ccSegmentId,
		ccSynced: segment.ccSegmentId !== null,
		createdAt: segment.createdAt,
	};
}

async function getSegmentOrThrow(id: string): Promise<Segment> {
	const segment = await prisma.segment.findUnique({ where: { id } });
	if (!segment) {
		throw new NotFoundError("Segment not found");
	}
	return segment;
}

export const SegmentsService = {
	async list() {
		const segments = await prisma.segment.findMany({
			orderBy: { createdAt: "desc" },
			include: { _count: { select: { members: true } } },
		});
		return {
			items: segments.map((segment) => toSegmentItem(segment, segment._count.members)),
		};
	},

	async create(input: CreateSegmentInput) {
		const segment = await prisma.segment.create({
			data: { name: input.name, type: input.type, criteriaJson: cleanCriteria(input.criteria) },
		});
		const memberCount = await materializeSegment(segment.id, input.criteria);
		return { segment: toSegmentItem(segment, memberCount) };
	},

	async getById(id: string, pagination: PaginationParams) {
		const segment = await getSegmentOrThrow(id);
		const [members, total] = await Promise.all([
			prisma.segmentMember.findMany({
				where: { segmentId: id },
				orderBy: { addedAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				include: { contact: { include: { organization: organizationSelect } } },
			}),
			prisma.segmentMember.count({ where: { segmentId: id } }),
		]);

		return {
			segment: toSegmentItem(segment, total),
			members: {
				items: members.map((member) => toContactListItem(member.contact)),
				page: pagination.page,
				pageSize: pagination.pageSize,
				total,
			},
		};
	},

	async update(id: string, input: UpdateSegmentInput) {
		const existing = await getSegmentOrThrow(id);
		// The type is immutable on update, so criteria.all must keep agreeing with it.
		if (input.criteria !== undefined && (input.criteria.all === true) !== (existing.type === "ALL")) {
			throw new BadRequestError(
				existing.type === "ALL"
					? "ALL segments require criteria.all to be true"
					: "criteria.all is only valid for ALL segments — use industry, aeOwner, or persona",
			);
		}
		const segment = await prisma.segment.update({
			where: { id },
			data: {
				name: input.name,
				criteriaJson: input.criteria === undefined ? undefined : cleanCriteria(input.criteria),
			},
		});
		if (
			input.criteria !== undefined &&
			JSON.stringify(existing.criteriaJson) !== JSON.stringify(cleanCriteria(input.criteria))
		) {
			await materializeSegment(id, input.criteria);
		}
		const memberCount = await prisma.segmentMember.count({ where: { segmentId: id } });
		return { segment: toSegmentItem(segment, memberCount) };
	},

	async remove(id: string) {
		await getSegmentOrThrow(id);
		await prisma.segment.delete({ where: { id } });
	},

	async refresh(id: string) {
		const segment = await getSegmentOrThrow(id);
		const memberCount = await materializeSegment(id, (segment.criteriaJson ?? {}) as SegmentCriteria);
		return { memberCount };
	},

	async addMembers(id: string, input: AddSegmentMembersInput) {
		await getSegmentOrThrow(id);
		// Only insert contacts that actually exist so a stale id can't blow up the batch.
		const contacts = await prisma.contact.findMany({
			where: { id: { in: input.contactIds } },
			select: { id: true },
		});
		if (contacts.length > 0) {
			await prisma.segmentMember.createMany({
				data: contacts.map((contact) => ({ segmentId: id, contactId: contact.id })),
				skipDuplicates: true,
			});
		}
		const memberCount = await prisma.segmentMember.count({ where: { segmentId: id } });
		return { memberCount };
	},

	async removeMember(id: string, contactId: string) {
		await getSegmentOrThrow(id);
		await prisma.segmentMember.deleteMany({ where: { segmentId: id, contactId } });
	},

	async syncToCc(id: string, userId: string | null) {
		const segment = await prisma.segment.findUnique({
			where: { id },
			include: {
				members: {
					include: { contact: { include: { organization: { select: { name: true } } } } },
				},
			},
		});
		if (!segment) {
			throw new NotFoundError("Segment not found");
		}

		let ccListId = segment.ccSegmentId;
		if (!ccListId) {
			const { listId } = await ccClient.createList(segment.name);
			ccListId = listId;
			await prisma.segment.update({ where: { id }, data: { ccSegmentId: listId } });
		}

		// Hard-bounced contacts are suppressed — never push them to CC lists.
		const rows = segment.members
			.filter((member) => member.contact.bouncedAt === null)
			.map((member) => ({
				email: member.contact.email.toLowerCase(),
				first_name: member.contact.firstName || undefined,
				last_name: member.contact.lastName || undefined,
				job_title: member.contact.title ?? undefined,
				company_name: member.contact.organization?.name ?? undefined,
			}));
		// CC bulk import does not return per-contact ids, so Contact.ccContactId
		// intentionally stays null here (per contract).
		if (rows.length > 0) {
			await ccClient.bulkImportContacts(rows, [ccListId]);
		}

		await audit(userId, "segment.sync-to-cc", "segment", {
			segmentId: id,
			ccListId,
			pushed: rows.length,
		});

		return { ccListId, pushed: rows.length };
	},
};
