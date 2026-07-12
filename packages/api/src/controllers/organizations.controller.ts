import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { OrganizationsService } from "../services/organizations.service";
import {
	createOrganizationSchema,
	listOrganizationsQuerySchema,
	updateOrganizationSchema,
} from "../validators/organizations.validator";

export const OrganizationsController = {
	async list(ctx: Context) {
		const query = listOrganizationsQuerySchema.parse({
			search: ctx.req.query("search") || undefined,
			industry: ctx.req.query("industry") || undefined,
			aeOwner: ctx.req.query("aeOwner") || undefined,
		});
		const pagination = parsePagination(ctx.req.query());
		const result = await OrganizationsService.list(query, pagination);
		return ctx.json(result);
	},

	async create(ctx: Context) {
		const body = createOrganizationSchema.parse(await ctx.req.json());
		const result = await OrganizationsService.create(body);
		return ctx.json(result, 201);
	},

	async get(ctx: Context) {
		const result = await OrganizationsService.getById(requiredParam(ctx, "id"));
		return ctx.json(result);
	},

	async update(ctx: Context) {
		const body = updateOrganizationSchema.parse(await ctx.req.json());
		const result = await OrganizationsService.update(requiredParam(ctx, "id"), body);
		return ctx.json(result);
	},

	async remove(ctx: Context) {
		await OrganizationsService.remove(requiredParam(ctx, "id"));
		return ctx.body(null, 204);
	},
};
