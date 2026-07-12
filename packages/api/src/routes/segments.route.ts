import { Hono } from "hono";
import { SegmentsController } from "../controllers/segments.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const segmentsRoutes = new Hono();

segmentsRoutes.get("/", requireAuth(), SegmentsController.list);
segmentsRoutes.post("/", requireAuth(), SegmentsController.create);
segmentsRoutes.get("/:id", requireAuth(), SegmentsController.get);
segmentsRoutes.put("/:id", requireAuth(), SegmentsController.update);
segmentsRoutes.delete("/:id", requireAuth(), SegmentsController.remove);
segmentsRoutes.post("/:id/refresh", requireAuth(), SegmentsController.refresh);
segmentsRoutes.post("/:id/members", requireAuth(), SegmentsController.addMembers);
segmentsRoutes.delete("/:id/members/:contactId", requireAuth(), SegmentsController.removeMember);
segmentsRoutes.post("/:id/sync-to-cc", requireAuth(), SegmentsController.syncToCc);
