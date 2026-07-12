import { ExternalApiError } from "@cqsd/shared/http";
import type { ExchangedTokens } from "../types";
import { msTokenUrl } from "./urls";

// Verify against the current Microsoft identity platform docs before go-live (build brief §4/§7b).
// This is the DELEGATED flow for the webinar organizer mailbox (VirtualEvent.ReadWrite) — separate
// from the app-only client-credentials flow in `app-only-token.ts`.
export interface MsOAuthConfig {
	tenantId: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
	/** Space-separated delegated scopes, e.g. "offline_access VirtualEvent.ReadWrite". */
	scopes: string;
}

export function buildMsAuthorizeUrl(config: MsOAuthConfig, state: string): string {
	const url = new URL(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/authorize`);
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("response_mode", "query");
	url.searchParams.set("scope", config.scopes);
	url.searchParams.set("state", state);
	return url.toString();
}

interface MsTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string;
	token_type: string;
}

async function requestToken(
	config: MsOAuthConfig,
	grantParams: Record<string, string>,
): Promise<ExchangedTokens> {
	const response = await fetch(msTokenUrl(config.tenantId), {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: config.clientId,
			client_secret: config.clientSecret,
			scope: config.scopes,
			...grantParams,
		}),
	});

	if (!response.ok) {
		throw new ExternalApiError(
			"microsoft_graph",
			`token request failed with ${response.status}: ${await response.text()}`,
		);
	}

	const payload = (await response.json()) as MsTokenResponse;
	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token,
		expiresAt: new Date(Date.now() + payload.expires_in * 1000),
		scope: payload.scope,
	};
}

export async function exchangeMsAuthorizationCode(
	config: MsOAuthConfig,
	code: string,
): Promise<ExchangedTokens> {
	return requestToken(config, { grant_type: "authorization_code", code, redirect_uri: config.redirectUri });
}

export async function refreshMsTokens(config: MsOAuthConfig, refreshToken: string): Promise<ExchangedTokens> {
	return requestToken(config, { grant_type: "refresh_token", refresh_token: refreshToken });
}
