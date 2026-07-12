import { z } from "zod";
import { personaSchema } from "./contacts.validator";

export const segmentCriteriaSchema = z
	.object({
		/** All-contacts segment ("send it to everybody") — matches every contact. */
		all: z.literal(true).optional(),
		industry: z.string().min(1).optional(),
		aeOwner: z.string().min(1).optional(),
		persona: personaSchema.optional(),
	})
	.refine(
		(criteria) =>
			criteria.all === true ||
			criteria.industry !== undefined ||
			criteria.aeOwner !== undefined ||
			criteria.persona !== undefined,
		{ message: "At least one criterion (all, industry, aeOwner, or persona) is required" },
	);
export type SegmentCriteria = z.infer<typeof segmentCriteriaSchema>;

export const createSegmentSchema = z
	.object({
		name: z.string().min(1),
		type: z.enum(["INDUSTRY", "AE", "PERSONA", "ALL"]),
		criteria: segmentCriteriaSchema,
	})
	.superRefine((input, ctx) => {
		if (input.type === "ALL" && input.criteria.all !== true) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["criteria", "all"],
				message: "ALL segments require criteria.all to be true",
			});
		}
		if (input.type !== "ALL" && input.criteria.all === true) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["criteria", "all"],
				message: "criteria.all is only valid for ALL segments — use industry, aeOwner, or persona",
			});
		}
	});
export type CreateSegmentInput = z.infer<typeof createSegmentSchema>;

export const updateSegmentSchema = z.object({
	name: z.string().min(1).optional(),
	criteria: segmentCriteriaSchema.optional(),
});
export type UpdateSegmentInput = z.infer<typeof updateSegmentSchema>;

export const addSegmentMembersSchema = z.object({
	contactIds: z.array(z.string().min(1)).min(1),
});
export type AddSegmentMembersInput = z.infer<typeof addSegmentMembersSchema>;
