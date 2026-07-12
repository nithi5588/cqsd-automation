import { apiEnv } from "@cqsd/config";
import { logger } from "@cqsd/shared/logger";
import { createApp } from "./app";
import { startWorkers } from "./workers";

const app = createApp();

const server = Bun.serve({ port: apiEnv.PORT, fetch: app.fetch });

logger.info(`api listening on http://localhost:${server.port}`);

startWorkers();
