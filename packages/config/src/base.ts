import { z } from "zod";

/** Env vars every CQSD service needs, regardless of role. */
export const baseEnv = {
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
	DATABASE_URL: z.string().url(),
	REDIS_URL: z.string().url().default("redis://localhost:6379"),
	JWT_SECRET: z.string().min(16),
	JWT_ISSUER: z.string().default("cqsd-marketing-automation"),
	JWT_AUDIENCE: z.string().default("cqsd-dashboard"),
	ENCRYPTION_KEY: z.string().min(1),
	APP_BASE_URL: z.string().url().default("http://localhost:3000"),
};
