import { z } from "zod";

const isoDate = z.coerce.date();

export const listWebinarsQuerySchema = z.object({
	status: z.enum(["DRAFT", "PUBLISHED", "CANCELED", "COMPLETED"]).optional(),
});
export type ListWebinarsQuery = z.infer<typeof listWebinarsQuerySchema>;

export const createWebinarSchema = z
	.object({
		title: z.string().min(1).max(300),
		description: z.string().max(5000).optional(),
		startsAt: isoDate,
		endsAt: isoDate,
		timeZone: z.string().min(1).max(100),
	})
	.refine((value) => value.endsAt.getTime() > value.startsAt.getTime(), {
		message: "endsAt must be after startsAt",
		path: ["endsAt"],
	});
export type CreateWebinarInput = z.infer<typeof createWebinarSchema>;

export const updateWebinarSchema = z.object({
	title: z.string().min(1).max(300).optional(),
	description: z.string().max(5000).nullish(),
	startsAt: isoDate.optional(),
	endsAt: isoDate.optional(),
	timeZone: z.string().min(1).max(100).optional(),
});
export type UpdateWebinarInput = z.infer<typeof updateWebinarSchema>;

export const publicRegisterSchema = z.object({
	name: z.string().min(1).max(200),
	email: z.string().email(),
	company: z.string().min(1).max(200).optional(),
});
export type PublicRegisterInput = z.infer<typeof publicRegisterSchema>;

/**
 * Manual attendance import — rows parsed client-side from the attendance CSV that
 * Teams lets the organizer download. Fallback for tenants where the Graph
 * app-only permissions are not (yet) granted.
 */
export const importAttendanceSchema = z.object({
	rows: z
		.array(
			z.object({
				name: z.string().max(200).optional(),
				email: z.string().email(),
				joinTime: isoDate.optional(),
				leaveTime: isoDate.optional(),
				durationSeconds: z
					.number()
					.int()
					.min(0)
					.max(60 * 60 * 24)
					.optional(),
			}),
		)
		.min(1)
		.max(2000),
});
export type ImportAttendanceInput = z.infer<typeof importAttendanceSchema>;
