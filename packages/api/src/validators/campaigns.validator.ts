import { z } from "zod";

export const campaignStatusSchema = z.enum(["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"]);

export const listCampaignsQuerySchema = z.object({
	status: campaignStatusSchema.optional(),
	search: z.string().optional(),
});
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

const isoDateString = z
	.string()
	.refine((value) => !Number.isNaN(Date.parse(value)), { message: "Must be a valid ISO date string" });

export const createCampaignSchema = z.object({
	name: z.string().min(1),
	subject: z.string().min(1),
	fromName: z.string().min(1),
	fromEmail: z.string().email(),
	replyTo: z.string().email().optional(),
	htmlContent: z.string().optional(),
	templateId: z.string().optional(),
	webinarId: z.string().optional(),
	volumeNumber: z.number().int().optional(),
	segmentId: z.string().optional(),
	scheduledAt: isoDateString.optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const updateCampaignSchema = z.object({
	name: z.string().min(1).optional(),
	subject: z.string().min(1).optional(),
	fromName: z.string().min(1).nullish(),
	fromEmail: z.string().email().nullish(),
	replyTo: z.string().email().nullish(),
	htmlContent: z.string().nullish(),
	templateId: z.string().nullish(),
	webinarId: z.string().nullish(),
	volumeNumber: z.number().int().nullish(),
	segmentId: z.string().nullish(),
	scheduledAt: isoDateString.nullish(),
});
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

export const scheduleCampaignSchema = z.object({
	scheduledAt: isoDateString.refine((value) => Date.parse(value) > Date.now(), {
		message: "scheduledAt must be in the future",
	}),
});
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;

export const sendTestSchema = z.object({
	emails: z.array(z.string().email()).min(1).max(5),
});
export type SendTestInput = z.infer<typeof sendTestSchema>;

export const activityFilterSchema = z.enum(["all", "opened", "clicked"]).default("all");
export type ActivityFilter = z.infer<typeof activityFilterSchema>;
