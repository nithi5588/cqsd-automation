import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { ConnectionsService } from "../services/connections.service";

export const ConnectionsController = {
	async status(ctx: Context) {
		const status = await ConnectionsService.getStatus();
		return ctx.json(status);
	},

	async importConstantContact(ctx: Context) {
		const authUser = ctx.get("authUser");
		const { jobId } = await ConnectionsService.startConstantContactImport(authUser.sub);
		return ctx.json({ jobId }, 202);
	},

	async importConstantContactStatus(ctx: Context) {
		const status = await ConnectionsService.getConstantContactImportStatus(requiredParam(ctx, "jobId"));
		return ctx.json(status);
	},
};
