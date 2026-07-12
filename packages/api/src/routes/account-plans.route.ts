import { Hono } from "hono";
import { AccountPlansController } from "../controllers/account-plans.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const accountPlansRoutes = new Hono();

accountPlansRoutes.get("/", requireAuth(), AccountPlansController.list);
accountPlansRoutes.get("/:orgId", requireAuth(), AccountPlansController.detail);
accountPlansRoutes.get("/:orgId/export", requireAuth(), AccountPlansController.exportCsv);
