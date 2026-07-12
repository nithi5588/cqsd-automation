import { type Contact, type Prisma, prisma } from "@cqsd/db";
import { BadRequestError, ConflictError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import type {
	CreateContactInput,
	ImportContactsInput,
	ListContactsQuery,
	PersonaValue,
	UpdateContactInput,
} from "../validators/contacts.validator";
import type { SegmentCriteria } from "../validators/segments.validator";
import { audit } from "./audit.service";
import { materializeSegment } from "./segment-membership";

const organizationSelect = { select: { id: true, name: true } } as const;

/**
 * Persona keyword rules for job titles, checked in order. CUSTOMER_SERVICE runs
 * before IT so "Customer Support Engineer" lands in CUSTOMER_SERVICE, and IT runs
 * before LINE_OF_BUSINESS so "VP of Infrastructure" lands in IT. Short tokens
 * (it, cio, cx, …) are word-bounded so they never match inside other words.
 */
const PERSONA_TITLE_RULES: ReadonlyArray<{ persona: PersonaValue; pattern: RegExp }> = [
	{
		persona: "CUSTOMER_SERVICE",
		pattern: /\b(?:customer|client success|client services|support|(?:call|contact) center|cx)\b/,
	},
	{
		persona: "IT",
		pattern:
			/\b(?:it|information technology|infosec|information security|cio|cto|systems?|infrastructure|network|security|developer|software engineer(?:ing)?|architect(?:ure)?)\b/,
	},
	{
		persona: "LINE_OF_BUSINESS",
		pattern: /\b(?:operations|coo|cfo|finance|sales|marketing|strategy|procurement|supply chain)\b/,
	},
];

/** Derives a persona from a job title, or null when the title matches no rule. */
function inferPersonaFromTitle(title: string | null | undefined): PersonaValue | null {
	if (!title) {
		return null;
	}
	const normalized = title.toLowerCase();
	for (const rule of PERSONA_TITLE_RULES) {
		if (rule.pattern.test(normalized)) {
			return rule.persona;
		}
	}
	return null;
}

export type ContactWithOrganization = Contact & {
	organization: { id: string; name: string } | null;
};

/** Shared serializer for the ContactListItem shape used across contacts, organizations, and segments. */
export function toContactListItem(contact: ContactWithOrganization) {
	return {
		id: contact.id,
		firstName: contact.firstName,
		lastName: contact.lastName,
		email: contact.email,
		title: contact.title,
		industry: contact.industry,
		persona: contact.persona,
		source: contact.source,
		ccContactId: contact.ccContactId,
		ccSynced: contact.ccContactId !== null,
		bounced: contact.bouncedAt !== null,
		organization: contact.organization
			? { id: contact.organization.id, name: contact.organization.name }
			: null,
		createdAt: contact.createdAt,
	};
}

/** Finds an organization by case-insensitive name, creating it (with optional defaults) when missing. */
export async function findOrCreateOrganizationByName(
	name: string,
	defaults?: { industry?: string; aeOwner?: string },
): Promise<{ id: string }> {
	const trimmed = name.trim();
	const existing = await prisma.organization.findFirst({
		where: { name: { equals: trimmed, mode: "insensitive" } },
		select: { id: true },
	});
	if (existing) {
		return existing;
	}
	return prisma.organization.create({
		data: {
			name: trimmed,
			industry: defaults?.industry ?? null,
			aeOwner: defaults?.aeOwner ?? null,
		},
		select: { id: true },
	});
}

function buildListWhere(query: ListContactsQuery): Prisma.ContactWhereInput {
	const conditions: Prisma.ContactWhereInput[] = [];
	if (query.search) {
		conditions.push({
			OR: [
				{ firstName: { contains: query.search, mode: "insensitive" } },
				{ lastName: { contains: query.search, mode: "insensitive" } },
				{ email: { contains: query.search, mode: "insensitive" } },
			],
		});
	}
	if (query.persona) {
		conditions.push({ persona: query.persona });
	}
	if (query.industry) {
		conditions.push({
			OR: [
				{ industry: { equals: query.industry, mode: "insensitive" } },
				{ organization: { industry: { equals: query.industry, mode: "insensitive" } } },
			],
		});
	}
	if (query.orgId) {
		conditions.push({ orgId: query.orgId });
	}
	if (query.segmentId) {
		conditions.push({ segmentMemberships: { some: { segmentId: query.segmentId } } });
	}
	return conditions.length > 0 ? { AND: conditions } : {};
}

export const ContactsService = {
	async list(query: ListContactsQuery, pagination: PaginationParams) {
		const where = buildListWhere(query);
		const [contacts, total] = await Promise.all([
			prisma.contact.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				include: { organization: organizationSelect },
			}),
			prisma.contact.count({ where }),
		]);

		return {
			items: contacts.map(toContactListItem),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async create(input: CreateContactInput) {
		const email = input.email.toLowerCase();
		const existing = await prisma.contact.findUnique({ where: { email }, select: { id: true } });
		if (existing) {
			throw new ConflictError(`A contact with email ${email} already exists`);
		}

		let orgId: string | null = null;
		if (input.orgId) {
			const organization = await prisma.organization.findUnique({
				where: { id: input.orgId },
				select: { id: true },
			});
			if (!organization) {
				throw new BadRequestError("Organization not found for provided orgId");
			}
			orgId = organization.id;
		} else if (input.orgName) {
			orgId = (await findOrCreateOrganizationByName(input.orgName)).id;
		}

		const contact = await prisma.contact.create({
			data: {
				firstName: input.firstName,
				lastName: input.lastName,
				email,
				title: input.title ?? null,
				industry: input.industry ?? null,
				persona: input.persona ?? inferPersonaFromTitle(input.title),
				orgId,
			},
			include: { organization: organizationSelect },
		});

		return { contact: toContactListItem(contact) };
	},

	async getById(id: string) {
		const contact = await prisma.contact.findUnique({
			where: { id },
			include: {
				organization: organizationSelect,
				campaignActivity: {
					include: { campaign: { select: { id: true, name: true, subject: true } } },
					orderBy: { firstOpenAt: { sort: "desc", nulls: "last" } },
				},
				registrations: {
					include: { webinar: { select: { id: true, title: true } } },
					orderBy: { registeredAt: "desc" },
				},
				attendances: {
					include: { webinar: { select: { id: true, title: true } } },
					orderBy: { joinTime: { sort: "desc", nulls: "last" } },
				},
			},
		});
		if (!contact) {
			throw new NotFoundError("Contact not found");
		}

		const rows = contact.campaignActivity.map((activity) => ({
			campaignId: activity.campaignId,
			campaignName: activity.campaign.name,
			subject: activity.campaign.subject,
			opened: activity.opened,
			clicked: activity.clicked,
			openCount: activity.openCount,
			clickCount: activity.clickCount,
			firstOpenAt: activity.firstOpenAt,
			firstClickAt: activity.firstClickAt,
		}));

		return {
			contact: {
				...toContactListItem(contact),
				activity: {
					campaignsSent: rows.length,
					opens: rows.reduce((sum, row) => sum + row.openCount, 0),
					clicks: rows.reduce((sum, row) => sum + row.clickCount, 0),
					rows,
				},
				registrations: contact.registrations.map((registration) => ({
					webinarId: registration.webinarId,
					webinarTitle: registration.webinar.title,
					registeredAt: registration.registeredAt,
				})),
				attendance: contact.attendances.map((attendance) => ({
					webinarId: attendance.webinarId,
					webinarTitle: attendance.webinar.title,
					durationSeconds: attendance.durationSeconds,
					joinTime: attendance.joinTime,
				})),
			},
		};
	},

	async update(id: string, input: UpdateContactInput) {
		const existing = await prisma.contact.findUnique({ where: { id } });
		if (!existing) {
			throw new NotFoundError("Contact not found");
		}

		const email = input.email?.toLowerCase();
		if (email && email !== existing.email) {
			const duplicate = await prisma.contact.findUnique({ where: { email }, select: { id: true } });
			if (duplicate) {
				throw new ConflictError(`A contact with email ${email} already exists`);
			}
		}

		let orgId: string | null | undefined = input.orgId;
		if (typeof input.orgId === "string") {
			const organization = await prisma.organization.findUnique({
				where: { id: input.orgId },
				select: { id: true },
			});
			if (!organization) {
				throw new BadRequestError("Organization not found for provided orgId");
			}
		} else if (input.orgId === undefined && input.orgName) {
			orgId = (await findOrCreateOrganizationByName(input.orgName)).id;
		}

		// A new title re-runs persona inference when the caller didn't set persona
		// explicitly — but inference never clears an existing persona with null.
		let persona = input.persona;
		if (persona === undefined && input.title != null) {
			persona = inferPersonaFromTitle(input.title) ?? undefined;
		}

		const contact = await prisma.contact.update({
			where: { id },
			data: {
				firstName: input.firstName,
				lastName: input.lastName,
				email,
				title: input.title,
				industry: input.industry,
				persona,
				orgId,
			},
			include: { organization: organizationSelect },
		});

		return { contact: toContactListItem(contact) };
	},

	async remove(id: string) {
		const existing = await prisma.contact.findUnique({ where: { id }, select: { id: true } });
		if (!existing) {
			throw new NotFoundError("Contact not found");
		}
		await prisma.contact.delete({ where: { id } });
	},

	async importContacts(input: ImportContactsInput, userId: string | null) {
		const job = await prisma.leadImportJob.create({
			data: { source: input.source, status: "PROCESSING" },
		});

		const contactSource = input.source === "CSV" ? "CSV_IMPORT" : "LEADGEN";
		const skipped: Array<{ email: string; reason: string }> = [];
		const seenEmails = new Set<string>();
		const orgIdsByName = new Map<string, string>();
		let created = 0;
		let updated = 0;

		try {
			for (const row of input.rows) {
				const email = row.email.toLowerCase();
				if (seenEmails.has(email)) {
					skipped.push({ email, reason: "Duplicate email within import batch" });
					continue;
				}
				seenEmails.add(email);

				try {
					let orgId: string | undefined;
					if (row.orgName) {
						const orgKey = row.orgName.trim().toLowerCase();
						const cached = orgIdsByName.get(orgKey);
						if (cached) {
							orgId = cached;
						} else {
							const organization = await findOrCreateOrganizationByName(row.orgName, {
								industry: row.industry,
								aeOwner: row.aeOwner,
							});
							orgIdsByName.set(orgKey, organization.id);
							orgId = organization.id;
						}
					}

					const existing = await prisma.contact.findUnique({
						where: { email },
						select: { id: true },
					});
					if (existing) {
						await prisma.contact.update({
							where: { email },
							data: {
								firstName: row.firstName,
								lastName: row.lastName,
								title: row.title,
								industry: row.industry,
								// Inference never clears a persona: null falls through to undefined (no-op).
								persona: row.persona ?? inferPersonaFromTitle(row.title) ?? undefined,
								orgId,
								source: contactSource,
							},
						});
						updated += 1;
					} else {
						await prisma.contact.create({
							data: {
								firstName: row.firstName,
								lastName: row.lastName,
								email,
								title: row.title ?? null,
								industry: row.industry ?? null,
								persona: row.persona ?? inferPersonaFromTitle(row.title),
								orgId: orgId ?? null,
								source: contactSource,
							},
						});
						created += 1;
					}
				} catch (error) {
					skipped.push({
						email,
						reason: error instanceof Error ? error.message : "Failed to import row",
					});
				}
			}
		} catch (error) {
			await prisma.leadImportJob.update({
				where: { id: job.id },
				data: {
					status: "FAILED",
					error: error instanceof Error ? error.message : "Import failed",
				},
			});
			throw error;
		}

		const completedJob = await prisma.leadImportJob.update({
			where: { id: job.id },
			data: { status: "COMPLETED", count: created + updated },
		});

		// Re-materialize every segment so imported contacts land in matching
		// segments automatically — no manual "refresh" step after an import.
		if (created + updated > 0) {
			const segments = await prisma.segment.findMany({
				select: { id: true, criteriaJson: true },
			});
			for (const segment of segments) {
				await materializeSegment(segment.id, (segment.criteriaJson ?? {}) as SegmentCriteria);
			}
		}

		await audit(userId, "contact.import", "contact", {
			jobId: job.id,
			source: input.source,
			created,
			updated,
			skipped: skipped.length,
		});

		return {
			job: { id: completedJob.id, status: completedJob.status, count: completedJob.count },
			created,
			updated,
			skipped,
		};
	},
};
