import { z } from "zod";

export const createUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	role: z.enum(["ADMIN", "MEMBER"]),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
	role: z.enum(["ADMIN", "MEMBER"]).optional(),
	password: z.string().min(8).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
