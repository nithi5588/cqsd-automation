import { createHash, randomBytes } from "node:crypto";
import { ExternalApiError } from "@cqsd/shared/http";
import type { ExchangedTokens } from "../types";

// Constant Contact v3 is Okta-hosted OAuth2. Current apps live on the
// authorization.cc.email domain; apps created before the migration used
// authz.constantcontact.com. Verify these paths against the current docs
// before go-live — endpoints and scope names both evolve (see build brief §4/§7a).
const AUTHORIZE_URL = "https://authorization.cc.email/oauth2/default/v1/authorize";
const TOKEN_URL = "https://authorization.cc.email/oauth2/default/v1/token";

export interface CcOAuthConfig {
	clientId: string;
	/**
	 * Absent for API-key-only Constant Contact apps (public clients). Without a
	 * secret the token endpoint gets no Authorization header — the client
	 * identifies itself via `client_id` in the form body and proves possession
	 * of the authorization code with PKCE.
	 */
	clientSecret?: string;
	redirectUri: string;
	scopes: string;
}

/** PKCE (RFC 7636) verifier/challenge pair for the authorization-code flow. */
export interface PkcePair {
	verifier: string;
	challenge: string;
}

/**
 * Generates an S256 PKCE pair: verifier = base64url of 32 random bytes
 * (43 chars, within RFC 7636's 43–128 range), challenge = base64url(SHA-256(verifier)).
 * Uses node:crypto, which Bun implements natively.
 */
export function generatePkcePair(): PkcePair {
	const verifier = randomBytes(32).toString("base64url");
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

export function buildCcAuthorizeUrl(config: CcOAuthConfig, state: string, codeChallenge?: string): string {
	const url = new URL(AUTHORIZE_URL);
	url.searchParams.set("client_id", config.clientId);
	url.searchParams.set("redirect_uri", config.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", config.scopes);
	url.searchParams.set("state", state);
	if (codeChallenge) {
		url.searchParams.set("code_challenge", codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
	}
	return url.toString();
}

interface CcTokenResponse {
	access_token: string;
	refresh_token: string;
	expires_in: number;
	scope: string;
	token_type: string;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
	return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestToken(config: CcOAuthConfig, body: URLSearchParams): Promise<ExchangedTokens> {
	const headers: Record<string, string> = {
		"Content-Type": "application/x-www-form-urlencoded",
	};
	if (config.clientSecret) {
		// Confidential client: authenticate the token endpoint with HTTP Basic.
		headers.Authorization = basicAuthHeader(config.clientId, config.clientSecret);
	} else {
		// Public client (API-key-only app): no Authorization header — the client
		// identifies itself in the form body instead.
		body.set("client_id", config.clientId);
	}

	const response = await fetch(TOKEN_URL, {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		throw new ExternalApiError(
			"constant_contact",
			`token request failed with ${response.status}: ${await response.text()}`,
		);
	}

	const payload = (await response.json()) as CcTokenResponse;
	return {
		accessToken: payload.access_token,
		refreshToken: payload.refresh_token,
		expiresAt: new Date(Date.now() + payload.expires_in * 1000),
		scope: payload.scope,
	};
}

export async function exchangeCcAuthorizationCode(
	config: CcOAuthConfig,
	code: string,
	codeVerifier?: string,
): Promise<ExchangedTokens> {
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code,
		redirect_uri: config.redirectUri,
	});
	if (codeVerifier) {
		body.set("code_verifier", codeVerifier);
	}
	return requestToken(config, body);
}

/**
 * Constant Contact rotates the refresh token on every refresh — the caller must
 * persist the newest `refreshToken` from the result or the connection is lost.
 */
export async function refreshCcTokens(config: CcOAuthConfig, refreshToken: string): Promise<ExchangedTokens> {
	return requestToken(
		config,
		new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
	);
}
