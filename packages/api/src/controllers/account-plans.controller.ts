import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { AccountPlansService } from "../services/account-plans.service";

export const AccountPlansController = {
	async list(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		return ctx.json(await AccountPlansService.list({ search: ctx.req.query("search") }, pagination));
	},

	async detail(ctx: Context) {
		return ctx.json(await AccountPlansService.detail(requiredParam(ctx, "orgId")));
	},

	async exportCsv(ctx: Context) {
		const { fileName, csv } = await AccountPlansService.exportCsv(requiredParam(ctx, "orgId"));
		ctx.header("Content-Type", "text/csv");
		ctx.header("Content-Disposition", `attachment; filename="${fileName}"`);
		return ctx.body(csv);
	},
};
