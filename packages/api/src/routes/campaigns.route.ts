import { Hono } from "hono";
import { CampaignsController } from "../controllers/campaigns.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const campaignsRoutes = new Hono();

campaignsRoutes.get("/", requireAuth(), CampaignsController.list);
campaignsRoutes.post("/", requireAuth(), CampaignsController.create);
campaignsRoutes.get("/:id", requireAuth(), CampaignsController.get);
campaignsRoutes.put("/:id", requireAuth(), CampaignsController.update);
campaignsRoutes.delete("/:id", requireAuth(), CampaignsController.remove);
campaignsRoutes.post("/:id/push-to-cc", requireAuth(), CampaignsController.pushToCc);
campaignsRoutes.post("/:id/send-test", requireAuth(), CampaignsController.sendTest);
campaignsRoutes.post("/:id/schedule", requireAuth(), CampaignsController.schedule);
campaignsRoutes.post("/:id/unschedule", requireAuth(), CampaignsController.unschedule);
campaignsRoutes.post("/:id/sync-stats", requireAuth(), CampaignsController.syncStats);
campaignsRoutes.get("/:id/activity/by-company", requireAuth(), CampaignsController.activityByCompany);
campaignsRoutes.get("/:id/activity", requireAuth(), CampaignsController.activity);
