import { ExternalApiError } from "@cqsd/shared/http";
import { msTokenUrl } from "./urls";

export interface AppOnlyTokenConfig {
	tenantId: string;
	clientId: string;
	clientSecret: string;
}

interface CachedToken {
	accessToken: string;
	expiresAtMs: number;
}

/**
 * App-only (client-credentials) tokens aren't tied to a user, so they're cached
 * in-process rather than stored in `oauth_connections`. Used for listing webinars,
 * reading attendance, and registering anonymous attendees (build brief §7b) — all
 * of which require the tenant admin to have granted an Application Access Policy
 * for MS_ORGANIZER_UPN, or these calls 403 even with the right permissions.
 */
let cached: CachedToken | null = null;

export async function getAppOnlyGraphToken(
	config: AppOnlyTokenConfig,
	opts?: { forceRefresh?: boolean },
): Promise<string> {
	if (!opts?.forceRefresh && cached && cached.expiresAtMs > Date.now() + 60_000) {
		return cached.accessToken;
	}

	const response = await fetch(msTokenUrl(config.tenantId), {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "client_credentials",
			client_id: config.clientId,
			client_secret: config.clientSecret,
			scope: "https://graph.microsoft.com/.default",
		}),
	});

	if (!response.ok) {
		throw new ExternalApiError(
			"microsoft_graph",
			`app-only token request failed with ${response.status}: ${await response.text()}`,
		);
	}

	const payload = (await response.json()) as { access_token: string; expires_in: number };
	cached = { accessToken: payload.access_token, expiresAtMs: Date.now() + payload.expires_in * 1000 };
	return cached.accessToken;
}
