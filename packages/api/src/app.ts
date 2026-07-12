import { checkDatabaseHealth } from "@cqsd/db";
import { toErrorResponse } from "@cqsd/shared/http";
import { logger } from "@cqsd/shared/logger";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoRequestLogger } from "hono/logger";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { routes } from "./routes";

export function createApp(): Hono {
	const app = new Hono();

	app.use(cors());
	app.use(honoRequestLogger());

	app.get("/health", async (ctx) => {
		try {
			await checkDatabaseHealth();
			return ctx.json({ status: "ok", database: "ok" });
		} catch (error) {
			logger.error({ err: error }, "health check: database unreachable");
			return ctx.json({ status: "degraded", database: "unreachable" }, 503);
		}
	});

	app.route("/", routes);

	app.notFound((ctx) => ctx.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

	// One place every thrown HttpError (and anything unexpected) turns into a
	// consistent JSON body, instead of each controller hand-rolling ctx.json(...).
	app.onError((error, ctx) => {
		const { status, body } = toErrorResponse(error);
		if (status >= 500) {
			logger.error({ err: error }, "unhandled error");
		}
		return ctx.json(body, status as ContentfulStatusCode);
	});

	return app;
}
