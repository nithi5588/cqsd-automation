import { Hono } from "hono";
import { WebinarsController } from "../controllers/webinars.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const webinarsRoutes = new Hono();

webinarsRoutes.get("/", requireAuth(), WebinarsController.list);
webinarsRoutes.post("/", requireAuth(), WebinarsController.create);
webinarsRoutes.get("/:id", requireAuth(), WebinarsController.get);
webinarsRoutes.put("/:id", requireAuth(), WebinarsController.update);
webinarsRoutes.delete("/:id", requireAuth(), WebinarsController.remove);
webinarsRoutes.post("/:id/publish", requireAuth(), WebinarsController.publish);
webinarsRoutes.get("/:id/registrations", requireAuth(), WebinarsController.registrations);
webinarsRoutes.get("/:id/attendance", requireAuth(), WebinarsController.attendance);
webinarsRoutes.post("/:id/attendance/sync", requireAuth(), WebinarsController.syncAttendance);
webinarsRoutes.post("/:id/attendance/import", requireAuth(), WebinarsController.importAttendance);
webinarsRoutes.get("/:id/account-plan", requireAuth(), WebinarsController.accountPlan);

/** Unauthenticated endpoints (mounted at /public): the website registration form reads and posts here. */
export const publicRoutes = new Hono();

publicRoutes.get("/webinars/:slug", WebinarsController.publicInfo);
publicRoutes.post("/webinars/:slug/register", WebinarsController.publicRegister);
