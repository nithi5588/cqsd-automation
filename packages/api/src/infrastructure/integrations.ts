import { apiEnv } from "@cqsd/config";
import {
	type AppOnlyTokenConfig,
	type CcOAuthConfig,
	ConstantContactClient,
	GraphClient,
	type MsOAuthConfig,
	TokenStore,
	getAppOnlyGraphToken,
	refreshCcTokens,
	refreshMsTokens,
} from "@cqsd/integrations";
import { ExternalApiError } from "@cqsd/shared/http";

/** Single construction point so every controller/service/worker shares one config shape. */
export const tokenStore = new TokenStore(apiEnv.ENCRYPTION_KEY);

export const ccOAuthConfig: CcOAuthConfig = {
	clientId: apiEnv.CC_CLIENT_ID,
	// undefined for API-key-only (public client) CC apps — the OAuth helpers then
	// skip HTTP Basic and send client_id in the token-request body with PKCE.
	clientSecret: apiEnv.CC_CLIENT_SECRET,
	redirectUri: apiEnv.CC_REDIRECT_URI,
	scopes: apiEnv.CC_SCOPES,
};

export const msOAuthConfig: MsOAuthConfig = {
	tenantId: apiEnv.MS_TENANT_ID,
	clientId: apiEnv.MS_CLIENT_ID,
	clientSecret: apiEnv.MS_CLIENT_SECRET,
	redirectUri: apiEnv.MS_REDIRECT_URI,
	scopes: apiEnv.MS_DELEGATED_SCOPES,
};

/** Client-credentials config for app-only Graph calls (sessions, registrations, attendance). */
export const msAppOnlyConfig: AppOnlyTokenConfig = {
	tenantId: apiEnv.MS_TENANT_ID,
	clientId: apiEnv.MS_CLIENT_ID,
	clientSecret: apiEnv.MS_CLIENT_SECRET,
};

type ConnectedProvider = "CONSTANT_CONTACT" | "MICROSOFT";

const PROVIDER_LABELS: Record<ConnectedProvider, string> = {
	CONSTANT_CONTACT: "constant_contact",
	MICROSOFT: "microsoft_graph",
};

/** Refresh a token this long before it actually expires so in-flight calls never race expiry. */
const EXPIRY_BUFFER_MS = 120_000;

/**
 * Dedupes concurrent refreshes per provider. Critical for Constant Contact: its
 * refresh tokens ROTATE, so two parallel refreshes would burn the same refresh
 * token twice and kill the connection.
 */
const refreshesInFlight = new Map<ConnectedProvider, Promise<string>>();

/**
 * Returns a currently-valid access token for the provider, refreshing (and
 * persisting the rotated tokens) when the stored one is missing headroom.
 * Pass `forceRefresh` after a 401 to bypass the expiry check.
 */
export async function getValidAccessToken(
	provider: ConnectedProvider,
	opts?: { forceRefresh?: boolean },
): Promise<string> {
	const tokens = await tokenStore.get(provider);
	if (!tokens) {
		throw new ExternalApiError(PROVIDER_LABELS[provider], "Not connected — complete OAuth in Connections");
	}

	const isStale = tokens.expiresAt.getTime() < Date.now() + EXPIRY_BUFFER_MS;
	if (!opts?.forceRefresh && !isStale) {
		return tokens.accessToken;
	}

	const inFlight = refreshesInFlight.get(provider);
	if (inFlight) return inFlight;

	const refreshPromise = (async () => {
		const refreshed =
			provider === "CONSTANT_CONTACT"
				? await refreshCcTokens(ccOAuthConfig, tokens.refreshToken)
				: await refreshMsTokens(msOAuthConfig, tokens.refreshToken);
		// CC rotates the refresh token on EVERY refresh — persist immediately or the connection is lost.
		await tokenStore.save({ provider, ...refreshed });
		return refreshed.accessToken;
	})();
	refreshesInFlight.set(provider, refreshPromise);
	try {
		return await refreshPromise;
	} finally {
		refreshesInFlight.delete(provider);
	}
}

/** Shared Constant Contact client — all services/workers go through this one instance. */
export const ccClient = new ConstantContactClient({
	getAccessToken: () => getValidAccessToken("CONSTANT_CONTACT"),
	getFreshAccessToken: () => getValidAccessToken("CONSTANT_CONTACT", { forceRefresh: true }),
});

/** Shared Microsoft Graph client — delegated for webinar writes, app-only for reads/registrations. */
export const graphClient = new GraphClient({
	getDelegatedToken: () => getValidAccessToken("MICROSOFT"),
	getFreshDelegatedToken: () => getValidAccessToken("MICROSOFT", { forceRefresh: true }),
	getAppOnlyToken: () => getAppOnlyGraphToken(msAppOnlyConfig),
	getFreshAppOnlyToken: () => getAppOnlyGraphToken(msAppOnlyConfig, { forceRefresh: true }),
	organizerUpn: apiEnv.MS_ORGANIZER_UPN,
});
