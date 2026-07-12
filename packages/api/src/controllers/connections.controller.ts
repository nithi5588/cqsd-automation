import type { Context } from "hono";
import { ConnectionsService } from "../services/connections.service";

export const ConnectionsController = {
	async status(ctx: Context) {
		const status = await ConnectionsService.getStatus();
		return ctx.json(status);
	},
};
