import { z } from "zod";

export const personaSchema = z.enum(["IT", "LINE_OF_BUSINESS", "CUSTOMER_SERVICE"]);
export type PersonaValue = z.infer<typeof personaSchema>;

export const listContactsQuerySchema = z.object({
	search: z.string().min(1).optional(),
	persona: personaSchema.optional(),
	industry: z.string().min(1).optional(),
	orgId: z.string().min(1).optional(),
	segmentId: z.string().min(1).optional(),
});
export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

export const createContactSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	email: z.string().email(),
	title: z.string().min(1).optional(),
	industry: z.string().min(1).optional(),
	persona: personaSchema.optional(),
	orgId: z.string().min(1).optional(),
	orgName: z.string().min(1).optional(),
});
export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z.object({
	firstName: z.string().min(1).optional(),
	lastName: z.string().min(1).optional(),
	email: z.string().email().optional(),
	title: z.string().min(1).nullable().optional(),
	industry: z.string().min(1).nullable().optional(),
	persona: personaSchema.nullable().optional(),
	orgId: z.string().min(1).nullable().optional(),
	orgName: z.string().min(1).optional(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const importContactRowSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	email: z.string().email(),
	title: z.string().min(1).optional(),
	industry: z.string().min(1).optional(),
	persona: personaSchema.optional(),
	orgName: z.string().min(1).optional(),
	aeOwner: z.string().min(1).optional(),
});
export type ImportContactRow = z.infer<typeof importContactRowSchema>;

export const importContactsSchema = z.object({
	source: z.enum(["CSV", "LEADGEN"]),
	rows: z.array(importContactRowSchema).min(1).max(5000),
});
export type ImportContactsInput = z.infer<typeof importContactsSchema>;
