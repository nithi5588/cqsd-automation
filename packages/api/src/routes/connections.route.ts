import { Hono } from "hono";
import { ConnectionsController } from "../controllers/connections.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const connectionsRoutes = new Hono();

connectionsRoutes.get("/", requireAuth(), ConnectionsController.status);
connectionsRoutes.post(
	"/constant-contact/import",
	requireAuth("ADMIN"),
	ConnectionsController.importConstantContact,
);
connectionsRoutes.get(
	"/constant-contact/import/:jobId",
	requireAuth("ADMIN"),
	ConnectionsController.importConstantContactStatus,
);
