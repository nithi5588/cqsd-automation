import { Hono } from "hono";
import { LeadsController } from "../controllers/leads.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const leadsRoutes = new Hono();

leadsRoutes.get("/imports", requireAuth(), LeadsController.listImports);
