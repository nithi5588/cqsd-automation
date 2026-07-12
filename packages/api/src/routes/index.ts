import { Hono } from "hono";
import { accountPlansRoutes } from "./account-plans.route";
import { adminRoutes } from "./admin.route";
import { authRoutes } from "./auth.route";
import { campaignsRoutes } from "./campaigns.route";
import { connectionsRoutes } from "./connections.route";
import { contactsRoutes } from "./contacts.route";
import { leadsRoutes } from "./leads.route";
import { oauthRoutes } from "./oauth.route";
import { organizationsRoutes } from "./organizations.route";
import { overviewRoutes } from "./overview.route";
import { segmentsRoutes } from "./segments.route";
import { publicRoutes, webinarsRoutes } from "./webinars.route";

export const routes = new Hono();

routes.route("/auth", authRoutes);
routes.route("/oauth", oauthRoutes);
routes.route("/connections", connectionsRoutes);
routes.route("/organizations", organizationsRoutes);
routes.route("/contacts", contactsRoutes);
routes.route("/segments", segmentsRoutes);
routes.route("/leads", leadsRoutes);
routes.route("/campaigns", campaignsRoutes);
routes.route("/webinars", webinarsRoutes);
routes.route("/public", publicRoutes);
routes.route("/account-plans", accountPlansRoutes);
routes.route("/overview", overviewRoutes);
routes.route("/admin", adminRoutes);
