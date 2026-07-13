import { apiEnv } from "@cqsd/config";
import { logger } from "@cqsd/shared/logger";
import { createApp } from "./app";
import { startWorkers } from "./workers";

const app = createApp();

// Bun's default per-request idle timeout is 10s. The Constant Contact import
// makes many sequential, rate-limit-respecting calls to CC's API in a single
// request/response cycle and can legitimately run past that on a real account
// — 180s comfortably covers it without needing a background-job rewrite.
const server = Bun.serve({ port: apiEnv.PORT, idleTimeout: 180, fetch: app.fetch });

logger.info(`api listening on http://localhost:${server.port}`);

startWorkers();
