import { Hono } from "hono";
import { AuthController } from "../controllers/auth.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const authRoutes = new Hono();

authRoutes.post("/login", AuthController.login);
authRoutes.get("/me", requireAuth(), AuthController.me);
