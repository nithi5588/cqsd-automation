import { Hono } from "hono";
import { OrganizationsController } from "../controllers/organizations.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const organizationsRoutes = new Hono();

organizationsRoutes.get("/", requireAuth(), OrganizationsController.list);
organizationsRoutes.post("/", requireAuth(), OrganizationsController.create);
organizationsRoutes.get("/:id", requireAuth(), OrganizationsController.get);
organizationsRoutes.put("/:id", requireAuth(), OrganizationsController.update);
organizationsRoutes.delete("/:id", requireAuth(), OrganizationsController.remove);
