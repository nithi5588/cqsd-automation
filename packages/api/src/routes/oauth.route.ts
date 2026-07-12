import { Hono } from "hono";
import { OAuthController } from "../controllers/oauth.controller";

export const oauthRoutes = new Hono();

oauthRoutes.get("/constant-contact/start", OAuthController.startConstantContact);
oauthRoutes.get("/constant-contact/callback", OAuthController.callbackConstantContact);
oauthRoutes.get("/microsoft/start", OAuthController.startMicrosoft);
oauthRoutes.get("/microsoft/callback", OAuthController.callbackMicrosoft);
