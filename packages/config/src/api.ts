import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { baseEnv } from "./base";
import { integrationsEnv } from "./integrations";

export const apiEnv = createEnv({
	server: {
		...baseEnv,
		...integrationsEnv,
		PORT: z.coerce.number().int().positive().default(3000),
		DASHBOARD_BASE_URL: z.string().url().default("http://localhost:3001"),
	},
	runtimeEnv: process.env,
	skipValidation: process.env.NODE_ENV === "test",
});
