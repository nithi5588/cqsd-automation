import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { CampaignsService } from "../services/campaigns.service";
import {
	activityFilterSchema,
	createCampaignSchema,
	listCampaignsQuerySchema,
	scheduleCampaignSchema,
	sendTestSchema,
	updateCampaignSchema,
} from "../validators/campaigns.validator";

export const CampaignsController = {
	async list(ctx: Context) {
		const query = listCampaignsQuerySchema.parse({
			status: ctx.req.query("status") || undefined,
			search: ctx.req.query("search") || undefined,
		});
		const pagination = parsePagination(ctx.req.query());
		const result = await CampaignsService.list(query, pagination);
		return ctx.json(result);
	},

	async create(ctx: Context) {
		const body = createCampaignSchema.parse(await ctx.req.json());
		const campaign = await CampaignsService.create(body);
		return ctx.json({ campaign }, 201);
	},

	async get(ctx: Context) {
		const campaign = await CampaignsService.getById(requiredParam(ctx, "id"));
		return ctx.json({ campaign });
	},

	async update(ctx: Context) {
		const body = updateCampaignSchema.parse(await ctx.req.json());
		const campaign = await CampaignsService.update(requiredParam(ctx, "id"), body);
		return ctx.json({ campaign });
	},

	async remove(ctx: Context) {
		await CampaignsService.remove(requiredParam(ctx, "id"));
		return ctx.body(null, 204);
	},

	async pushToCc(ctx: Context) {
		const authUser = ctx.get("authUser");
		const campaign = await CampaignsService.pushToCc(requiredParam(ctx, "id"), authUser.sub);
		return ctx.json({ campaign });
	},

	async sendTest(ctx: Context) {
		const body = sendTestSchema.parse(await ctx.req.json());
		await CampaignsService.sendTest(requiredParam(ctx, "id"), body.emails);
		return ctx.json({ ok: true });
	},

	async schedule(ctx: Context) {
		const body = scheduleCampaignSchema.parse(await ctx.req.json());
		const authUser = ctx.get("authUser");
		const campaign = await CampaignsService.schedule(
			requiredParam(ctx, "id"),
			body.scheduledAt,
			authUser.sub,
		);
		return ctx.json({ campaign });
	},

	async unschedule(ctx: Context) {
		const campaign = await CampaignsService.unschedule(requiredParam(ctx, "id"));
		return ctx.json({ campaign });
	},

	async syncStats(ctx: Context) {
		const stat = await CampaignsService.syncStats(requiredParam(ctx, "id"));
		return ctx.json({ stat });
	},

	async activity(ctx: Context) {
		const filter = activityFilterSchema.parse(ctx.req.query("filter") || undefined);
		const search = ctx.req.query("search") || undefined;
		const pagination = parsePagination(ctx.req.query());
		const result = await CampaignsService.activity(requiredParam(ctx, "id"), filter, search, pagination);
		return ctx.json(result);
	},

	async activityByCompany(ctx: Context) {
		const result = await CampaignsService.activityByCompany(requiredParam(ctx, "id"));
		return ctx.json(result);
	},
};
