import { Hono } from "hono";
import { OverviewController } from "../controllers/overview.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const overviewRoutes = new Hono();

overviewRoutes.get("/", requireAuth(), OverviewController.get);
