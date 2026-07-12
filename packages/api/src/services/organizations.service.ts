import { type Organization, type Prisma, prisma } from "@cqsd/db";
import { ConflictError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import type {
	CreateOrganizationInput,
	ListOrganizationsQuery,
	UpdateOrganizationInput,
} from "../validators/organizations.validator";
import { toContactListItem } from "./contacts.service";

function toOrganizationItem(organization: Organization, contactCount: number) {
	return {
		id: organization.id,
		name: organization.name,
		industry: organization.industry,
		// Prisma Decimal is not JSON-serializable as a number — convert explicitly.
		revenue: organization.revenue === null ? null : Number(organization.revenue),
		aeOwner: organization.aeOwner,
		contactCount,
		createdAt: organization.createdAt,
	};
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
	const existing = await prisma.organization.findFirst({
		where: {
			name: { equals: name, mode: "insensitive" },
			...(excludeId ? { id: { not: excludeId } } : {}),
		},
		select: { id: true },
	});
	if (existing) {
		throw new ConflictError(`An organization named "${name}" already exists`);
	}
}

export const OrganizationsService = {
	async list(query: ListOrganizationsQuery, pagination: PaginationParams) {
		const where: Prisma.OrganizationWhereInput = {};
		if (query.search) {
			where.name = { contains: query.search, mode: "insensitive" };
		}
		if (query.industry) {
			where.industry = { equals: query.industry, mode: "insensitive" };
		}
		if (query.aeOwner) {
			where.aeOwner = { equals: query.aeOwner, mode: "insensitive" };
		}

		const [organizations, total] = await Promise.all([
			prisma.organization.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				include: { _count: { select: { contacts: true } } },
			}),
			prisma.organization.count({ where }),
		]);

		return {
			items: organizations.map((organization) =>
				toOrganizationItem(organization, organization._count.contacts),
			),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async create(input: CreateOrganizationInput) {
		await assertNameAvailable(input.name);
		const organization = await prisma.organization.create({
			data: {
				name: input.name,
				industry: input.industry ?? null,
				revenue: input.revenue ?? null,
				aeOwner: input.aeOwner ?? null,
			},
		});
		return { organization: toOrganizationItem(organization, 0) };
	},

	async getById(id: string) {
		const organization = await prisma.organization.findUnique({
			where: { id },
			include: {
				contacts: {
					orderBy: { createdAt: "desc" },
					include: { organization: { select: { id: true, name: true } } },
				},
			},
		});
		if (!organization) {
			throw new NotFoundError("Organization not found");
		}

		return {
			organization: {
				...toOrganizationItem(organization, organization.contacts.length),
				contacts: organization.contacts.map(toContactListItem),
			},
		};
	},

	async update(id: string, input: UpdateOrganizationInput) {
		const existing = await prisma.organization.findUnique({ where: { id } });
		if (!existing) {
			throw new NotFoundError("Organization not found");
		}
		if (input.name && input.name.toLowerCase() !== existing.name.toLowerCase()) {
			await assertNameAvailable(input.name, id);
		}

		const organization = await prisma.organization.update({
			where: { id },
			data: {
				name: input.name,
				industry: input.industry,
				revenue: input.revenue,
				aeOwner: input.aeOwner,
			},
			include: { _count: { select: { contacts: true } } },
		});
		return { organization: toOrganizationItem(organization, organization._count.contacts) };
	},

	async remove(id: string) {
		const existing = await prisma.organization.findUnique({ where: { id }, select: { id: true } });
		if (!existing) {
			throw new NotFoundError("Organization not found");
		}
		await prisma.organization.delete({ where: { id } });
	},
};
