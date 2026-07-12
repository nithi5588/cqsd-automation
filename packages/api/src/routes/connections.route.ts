import { Hono } from "hono";
import { ConnectionsController } from "../controllers/connections.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const connectionsRoutes = new Hono();

connectionsRoutes.get("/", requireAuth(), ConnectionsController.status);
