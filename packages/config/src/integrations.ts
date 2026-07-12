import { z } from "zod";

/**
 * Env vars for the two external integrations. Shared by `api` (OAuth start/callback,
 * on-demand calls) and both sync workers (background jobs) so the schema — and the
 * client built from it — only exists once.
 */
export const integrationsEnv = {
	CC_CLIENT_ID: z.string().min(1),
	// Optional: Constant Contact apps that issue only an API key (public clients)
	// have no secret and authenticate with PKCE instead. An empty `CC_CLIENT_SECRET=`
	// line in .env arrives as "" — normalize it to undefined.
	CC_CLIENT_SECRET: z
		.string()
		.optional()
		.transform((value) => (value === "" ? undefined : value)),
	CC_REDIRECT_URI: z.string().url(),
	CC_SCOPES: z.string().default("contact_data campaign_data account_read offline_access"),

	MS_TENANT_ID: z.string().min(1),
	MS_CLIENT_ID: z.string().min(1),
	MS_CLIENT_SECRET: z.string().min(1),
	MS_ORGANIZER_UPN: z.string().email(),
	MS_REDIRECT_URI: z.string().url(),
	MS_DELEGATED_SCOPES: z.string().default("offline_access VirtualEvent.ReadWrite"),
	// Teams itself emails attendees registration confirmations and reminders
	// (from teamsevents.com). Defaults to true; set to "false" to turn it off.
	MS_TEAMS_ATTENDEE_EMAILS: z
		.string()
		.optional()
		.transform((value) => value !== "false"),
};
