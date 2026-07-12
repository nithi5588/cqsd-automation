import { Hono } from "hono";
import { AdminController } from "../controllers/admin.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const adminRoutes = new Hono();

adminRoutes.get("/users", requireAuth("ADMIN"), AdminController.listUsers);
adminRoutes.post("/users", requireAuth("ADMIN"), AdminController.createUser);
adminRoutes.put("/users/:id", requireAuth("ADMIN"), AdminController.updateUser);
adminRoutes.delete("/users/:id", requireAuth("ADMIN"), AdminController.deleteUser);
adminRoutes.get("/audit", requireAuth("ADMIN"), AdminController.listAudit);
