import { parsePagination } from "@cqsd/shared/http";
import type { Context } from "hono";
import { requiredParam } from "../lib/params";
import { AccountPlansService } from "../services/account-plans.service";
import { syncWebinarAttendance } from "../services/attendance-sync.service";
import { audit } from "../services/audit.service";
import { WebinarsService } from "../services/webinars.service";
import {
	createWebinarSchema,
	importAttendanceSchema,
	listWebinarsQuerySchema,
	publicRegisterSchema,
	updateWebinarSchema,
} from "../validators/webinars.validator";

export const WebinarsController = {
	async list(ctx: Context) {
		const { status } = listWebinarsQuerySchema.parse({ status: ctx.req.query("status") });
		const pagination = parsePagination(ctx.req.query());
		return ctx.json(await WebinarsService.list(status, pagination));
	},

	async create(ctx: Context) {
		const body = createWebinarSchema.parse(await ctx.req.json());
		const webinar = await WebinarsService.create(body);
		return ctx.json({ webinar });
	},

	async get(ctx: Context) {
		const webinar = await WebinarsService.get(requiredParam(ctx, "id"));
		return ctx.json({ webinar });
	},

	async update(ctx: Context) {
		const body = updateWebinarSchema.parse(await ctx.req.json());
		const webinar = await WebinarsService.update(requiredParam(ctx, "id"), body);
		return ctx.json({ webinar });
	},

	async remove(ctx: Context) {
		await WebinarsService.remove(requiredParam(ctx, "id"));
		return ctx.body(null, 204);
	},

	async publish(ctx: Context) {
		const id = requiredParam(ctx, "id");
		const webinar = await WebinarsService.publish(id);
		await audit(ctx.get("authUser").sub, "webinar.publish", "webinar", {
			webinarId: id,
			title: webinar.title,
			msWebinarId: webinar.msWebinarId,
		});
		return ctx.json({ webinar });
	},

	async registrations(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		return ctx.json(await WebinarsService.registrations(requiredParam(ctx, "id"), pagination));
	},

	async attendance(ctx: Context) {
		const pagination = parsePagination(ctx.req.query());
		return ctx.json(await WebinarsService.attendance(requiredParam(ctx, "id"), pagination));
	},

	async syncAttendance(ctx: Context) {
		const id = requiredParam(ctx, "id");
		const result = await syncWebinarAttendance(id);
		await audit(ctx.get("authUser").sub, "attendance.sync", "webinar", {
			webinarId: id,
			...result,
		});
		return ctx.json(result);
	},

	async importAttendance(ctx: Context) {
		const id = requiredParam(ctx, "id");
		const body = importAttendanceSchema.parse(await ctx.req.json());
		const result = await WebinarsService.importAttendance(id, body);
		await audit(ctx.get("authUser").sub, "attendance.import", "webinar", {
			webinarId: id,
			...result,
		});
		return ctx.json(result);
	},

	async accountPlan(ctx: Context) {
		return ctx.json(await AccountPlansService.webinarPlan(requiredParam(ctx, "id")));
	},

	async publicInfo(ctx: Context) {
		const webinar = await WebinarsService.publicInfo(requiredParam(ctx, "slug"));
		return ctx.json({ webinar });
	},

	async publicRegister(ctx: Context) {
		const body = publicRegisterSchema.parse(await ctx.req.json());
		const result = await WebinarsService.publicRegister(requiredParam(ctx, "slug"), body);
		return ctx.json(result);
	},
};
