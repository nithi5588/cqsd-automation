import { z } from "zod";

export const listOrganizationsQuerySchema = z.object({
	search: z.string().min(1).optional(),
	industry: z.string().min(1).optional(),
	aeOwner: z.string().min(1).optional(),
});
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;

export const createOrganizationSchema = z.object({
	name: z.string().min(1),
	industry: z.string().min(1).optional(),
	revenue: z.number().nonnegative().optional(),
	aeOwner: z.string().min(1).optional(),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
	name: z.string().min(1).optional(),
	industry: z.string().min(1).nullable().optional(),
	revenue: z.number().nonnegative().nullable().optional(),
	aeOwner: z.string().min(1).nullable().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
