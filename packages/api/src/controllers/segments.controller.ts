import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { SegmentsService } from "../services/segments.service";
import {
	addSegmentMembersSchema,
	createSegmentSchema,
	updateSegmentSchema,
} from "../validators/segments.validator";

export const SegmentsController = {
	async list(ctx: Context) {
		const result = await SegmentsService.list();
		return ctx.json(result);
	},

	async create(ctx: Context) {
		const body = createSegmentSchema.parse(await ctx.req.json());
		const result = await SegmentsService.create(body);
		return ctx.json(result, 201);
	},

	async get(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		const result = await SegmentsService.getById(requiredParam(ctx, "id"), pagination);
		return ctx.json(result);
	},

	async update(ctx: Context) {
		const body = updateSegmentSchema.parse(await ctx.req.json());
		const result = await SegmentsService.update(requiredParam(ctx, "id"), body);
		return ctx.json(result);
	},

	async remove(ctx: Context) {
		await SegmentsService.remove(requiredParam(ctx, "id"));
		return ctx.body(null, 204);
	},

	async refresh(ctx: Context) {
		const result = await SegmentsService.refresh(requiredParam(ctx, "id"));
		return ctx.json(result);
	},

	async addMembers(ctx: Context) {
		const body = addSegmentMembersSchema.parse(await ctx.req.json());
		const result = await SegmentsService.addMembers(requiredParam(ctx, "id"), body);
		return ctx.json(result);
	},

	async removeMember(ctx: Context) {
		await SegmentsService.removeMember(requiredParam(ctx, "id"), requiredParam(ctx, "contactId"));
		return ctx.body(null, 204);
	},

	async syncToCc(ctx: Context) {
		const authUser = ctx.get("authUser");
		const result = await SegmentsService.syncToCc(requiredParam(ctx, "id"), authUser?.sub ?? null);
		return ctx.json(result);
	},
};
