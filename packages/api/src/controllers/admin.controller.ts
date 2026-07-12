import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { AdminService } from "../services/admin.service";
import { audit } from "../services/audit.service";
import { createUserSchema, updateUserSchema } from "../validators/admin.validator";

export const AdminController = {
	async listUsers(ctx: Context) {
		return ctx.json(await AdminService.listUsers());
	},

	async createUser(ctx: Context) {
		const body = createUserSchema.parse(await ctx.req.json());
		const user = await AdminService.createUser(body);
		await audit(ctx.get("authUser").sub, "admin.user.create", "user", {
			userId: user.id,
			email: user.email,
			role: user.role,
		});
		return ctx.json({ user });
	},

	async updateUser(ctx: Context) {
		const id = requiredParam(ctx, "id");
		const body = updateUserSchema.parse(await ctx.req.json());
		const user = await AdminService.updateUser(id, body);
		await audit(ctx.get("authUser").sub, "admin.user.update", "user", {
			userId: id,
			// Field names only — never the values (a password may be present).
			fields: Object.keys(body),
		});
		return ctx.json({ user });
	},

	async deleteUser(ctx: Context) {
		const id = requiredParam(ctx, "id");
		const authUser = ctx.get("authUser");
		await AdminService.deleteUser(id, authUser.sub);
		await audit(authUser.sub, "admin.user.delete", "user", { userId: id });
		return ctx.body(null, 204);
	},

	async listAudit(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		return ctx.json(await AdminService.listAudit(pagination));
	},
};
