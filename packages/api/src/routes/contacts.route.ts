import { Hono } from "hono";
import { ContactsController } from "../controllers/contacts.controller";
import { requireAuth } from "../middlewares/auth.middleware";

export const contactsRoutes = new Hono();

contactsRoutes.get("/", requireAuth(), ContactsController.list);
contactsRoutes.post("/", requireAuth(), ContactsController.create);
contactsRoutes.post("/import", requireAuth(), ContactsController.importContacts);
contactsRoutes.get("/tags", requireAuth(), ContactsController.listTags);
contactsRoutes.get("/:id", requireAuth(), ContactsController.get);
contactsRoutes.put("/:id", requireAuth(), ContactsController.update);
contactsRoutes.delete("/:id", requireAuth(), ContactsController.remove);
