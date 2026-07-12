import { type UserRole, prisma } from "@cqsd/db";
import { BadRequestError, ConflictError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import { hashPassword } from "@cqsd/shared/security";
import type { CreateUserInput, UpdateUserInput } from "../validators/admin.validator";

function toUserItem(user: { id: string; email: string; role: UserRole; createdAt: Date }) {
	return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

export const AdminService = {
	async listUsers() {
		const users = await prisma.user.findMany({
			orderBy: { createdAt: "asc" },
			select: { id: true, email: true, role: true, createdAt: true },
		});
		return { items: users.map(toUserItem) };
	},

	async createUser(input: CreateUserInput) {
		const email = input.email.toLowerCase();
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) throw new ConflictError("A user with this email already exists");

		const user = await prisma.user.create({
			data: { email, passwordHash: await hashPassword(input.password), role: input.role },
		});
		return toUserItem(user);
	},

	async updateUser(id: string, input: UpdateUserInput) {
		const existing = await prisma.user.findUnique({ where: { id } });
		if (!existing) throw new NotFoundError("User not found");

		const user = await prisma.user.update({
			where: { id },
			data: {
				role: input.role,
				passwordHash: input.password ? await hashPassword(input.password) : undefined,
			},
		});
		return toUserItem(user);
	},

	async deleteUser(id: string, requesterId: string) {
		if (id === requesterId) {
			throw new BadRequestError("You cannot delete your own account");
		}
		const existing = await prisma.user.findUnique({ where: { id } });
		if (!existing) throw new NotFoundError("User not found");
		await prisma.user.delete({ where: { id } });
	},

	async listAudit(pagination: PaginationParams) {
		const [total, rows] = await Promise.all([
			prisma.auditLog.count(),
			prisma.auditLog.findMany({
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				include: { user: { select: { email: true } } },
			}),
		]);
		return {
			items: rows.map((row) => ({
				id: row.id,
				userId: row.userId,
				userEmail: row.user?.email ?? null,
				action: row.action,
				entity: row.entity,
				meta: row.meta,
				createdAt: row.createdAt,
			})),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},
};
