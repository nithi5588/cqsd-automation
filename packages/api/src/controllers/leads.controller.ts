import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { LeadsService } from "../services/leads.service";

export const LeadsController = {
	async listImports(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		const result = await LeadsService.listImports(pagination);
		return ctx.json(result);
	},
};
