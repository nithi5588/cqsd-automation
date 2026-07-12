import { type Prisma, prisma } from "@cqsd/db";
import type { SegmentCriteria } from "../validators/segments.validator";

/**
 * Translates stored segment criteria into a Contact where-clause. Lives outside
 * segments.service so contacts.service can re-materialize segments after an
 * import without creating an import cycle. Every branch excludes hard-bounced
 * contacts so re-materialization never re-adds them after suppression.
 */
export function buildCriteriaWhere(criteria: SegmentCriteria): Prisma.ContactWhereInput {
	// An all-contacts segment matches every non-bounced contact by definition.
	if (criteria.all === true) {
		return { bouncedAt: null };
	}
	const conditions: Prisma.ContactWhereInput[] = [];
	if (criteria.industry) {
		conditions.push({
			OR: [
				{ industry: { equals: criteria.industry, mode: "insensitive" } },
				{ organization: { industry: { equals: criteria.industry, mode: "insensitive" } } },
			],
		});
	}
	if (criteria.aeOwner) {
		conditions.push({
			organization: { aeOwner: { equals: criteria.aeOwner, mode: "insensitive" } },
		});
	}
	if (criteria.persona) {
		conditions.push({ persona: criteria.persona });
	}
	// An empty criteria object must never silently match every contact.
	if (conditions.length === 0) {
		return { id: { in: [] } };
	}
	return { AND: [{ bouncedAt: null }, ...conditions] };
}

/** Replaces a segment's members with the contacts currently matching its criteria. */
export async function materializeSegment(segmentId: string, criteria: SegmentCriteria): Promise<number> {
	const contacts = await prisma.contact.findMany({
		where: buildCriteriaWhere(criteria),
		select: { id: true },
	});
	await prisma.$transaction([
		prisma.segmentMember.deleteMany({ where: { segmentId } }),
		prisma.segmentMember.createMany({
			data: contacts.map((contact) => ({ segmentId, contactId: contact.id })),
			skipDuplicates: true,
		}),
	]);
	return contacts.length;
}
