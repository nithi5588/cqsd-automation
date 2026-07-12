import pino from "pino";

/**
 * One structured logger for every CQSD service (api + both sync workers) instead
 * of the pino/console.log split the reference codebase had. Redacts anything that
 * looks like a secret so tokens never end up in log output.
 */
export const logger = pino({
	level: process.env.LOG_LEVEL ?? "info",
	redact: {
		paths: [
			"*.accessToken",
			"*.refreshToken",
			"*.accessTokenEnc",
			"*.refreshTokenEnc",
			"*.password",
			"*.passwordHash",
			"req.headers.authorization",
		],
		censor: "[redacted]",
	},
	transport:
		process.env.NODE_ENV === "production"
			? undefined
			: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});

export function childLogger(component: string) {
	return logger.child({ component });
}
