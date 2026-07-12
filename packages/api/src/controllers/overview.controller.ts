import type { Context } from "hono";
import { OverviewService } from "../services/overview.service";

export const OverviewController = {
	async get(ctx: Context) {
		return ctx.json(await OverviewService.get());
	},
};
