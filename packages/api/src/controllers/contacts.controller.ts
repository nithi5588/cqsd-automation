import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { ContactsService } from "../services/contacts.service";
import {
	createContactSchema,
	importContactsSchema,
	listContactsQuerySchema,
	updateContactSchema,
} from "../validators/contacts.validator";

export const ContactsController = {
	async list(ctx: Context) {
		const query = listContactsQuerySchema.parse({
			search: ctx.req.query("search") || undefined,
			persona: ctx.req.query("persona") || undefined,
			industry: ctx.req.query("industry") || undefined,
			orgId: ctx.req.query("orgId") || undefined,
			segmentId: ctx.req.query("segmentId") || undefined,
		});
		const pagination = parsePagination(ctx.req.query());
		const result = await ContactsService.list(query, pagination);
		return ctx.json(result);
	},

	async create(ctx: Context) {
		const body = createContactSchema.parse(await ctx.req.json());
		const result = await ContactsService.create(body);
		return ctx.json(result, 201);
	},

	async get(ctx: Context) {
		const result = await ContactsService.getById(requiredParam(ctx, "id"));
		return ctx.json(result);
	},

	async update(ctx: Context) {
		const body = updateContactSchema.parse(await ctx.req.json());
		const result = await ContactsService.update(requiredParam(ctx, "id"), body);
		return ctx.json(result);
	},

	async remove(ctx: Context) {
		await ContactsService.remove(requiredParam(ctx, "id"));
		return ctx.body(null, 204);
	},

	async importContacts(ctx: Context) {
		const body = importContactsSchema.parse(await ctx.req.json());
		const authUser = ctx.get("authUser");
		const result = await ContactsService.importContacts(body, authUser?.sub ?? null);
		return ctx.json(result);
	},
};
