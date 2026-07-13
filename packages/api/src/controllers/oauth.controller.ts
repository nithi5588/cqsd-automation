import { apiEnv } from "@cqsd/config";
import {
	buildCcAuthorizeUrl,
	buildMsAuthorizeUrl,
	exchangeCcAuthorizationCode,
	exchangeMsAuthorizationCode,
	generatePkcePair,
} from "@cqsd/integrations";
import { BadRequestError } from "@cqsd/shared/http";
import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { ccOAuthConfig, msOAuthConfig, tokenStore } from "../infrastructure/integrations";

// 20 minutes — generous enough to cover a slow first-time login (password manager,
// MFA, "verify it's you" email) at the provider without the state/PKCE cookie
// expiring before the browser gets redirected back to the callback.
const STATE_COOKIE_MAX_AGE_SECONDS = 1200;

/** Holds the PKCE code verifier between the CC authorize redirect and the callback. */
const CC_VERIFIER_COOKIE = "oauth_verifier_cc";

/** Shared options for the short-lived OAuth cookies (state + PKCE verifier). */
function oauthCookieOptions() {
	return {
		httpOnly: true,
		secure: apiEnv.NODE_ENV === "production",
		sameSite: "Lax",
		maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
		path: "/",
	} as const;
}

function stateCookieName(provider: "cc" | "ms"): string {
	return `oauth_state_${provider}`;
}

/** Stamps a random state value into a short-lived httpOnly cookie so the callback can verify it. */
function issueState(ctx: Context, provider: "cc" | "ms"): string {
	const state = crypto.randomUUID();
	setCookie(ctx, stateCookieName(provider), state, oauthCookieOptions());
	return state;
}

/** Verifies the callback's `state` param against the cookie set by `issueState`, then clears it. */
function verifyState(ctx: Context, provider: "cc" | "ms"): void {
	const expected = getCookie(ctx, stateCookieName(provider));
	deleteCookie(ctx, stateCookieName(provider), { path: "/" });

	const actual = ctx.req.query("state");
	if (!expected || !actual || actual !== expected) {
		throw new BadRequestError("Invalid or expired OAuth state");
	}
}

/** Sends the browser back to the dashboard's Connections page after a callback. */
function connectionsRedirect(ctx: Context, params: Record<string, string>) {
	const url = new URL("/connections", apiEnv.DASHBOARD_BASE_URL);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return ctx.redirect(url.toString());
}

export const OAuthController = {
	startConstantContact(ctx: Context) {
		const state = issueState(ctx, "cc");
		// PKCE always — required for the secret-less (API-key-only) Constant Contact
		// app, and still valid/beneficial when a client secret is configured.
		const { verifier, challenge } = generatePkcePair();
		setCookie(ctx, CC_VERIFIER_COOKIE, verifier, oauthCookieOptions());
		return ctx.redirect(buildCcAuthorizeUrl(ccOAuthConfig, state, challenge));
	},

	async callbackConstantContact(ctx: Context) {
		try {
			verifyState(ctx, "cc");

			const code = ctx.req.query("code");
			if (!code) throw new BadRequestError('Missing "code" query parameter');

			const codeVerifier = getCookie(ctx, CC_VERIFIER_COOKIE);
			deleteCookie(ctx, CC_VERIFIER_COOKIE, { path: "/" });
			if (!codeVerifier) {
				throw new BadRequestError("Missing or expired PKCE verifier — restart the connection flow");
			}

			const tokens = await exchangeCcAuthorizationCode(ccOAuthConfig, code, codeVerifier);
			await tokenStore.save({ provider: "CONSTANT_CONTACT", ...tokens });
		} catch (error) {
			const message = error instanceof Error ? error.message : "OAuth failed";
			return connectionsRedirect(ctx, { error: message, provider: "constant_contact" });
		}

		return connectionsRedirect(ctx, { connected: "constant_contact" });
	},

	startMicrosoft(ctx: Context) {
		const state = issueState(ctx, "ms");
		return ctx.redirect(buildMsAuthorizeUrl(msOAuthConfig, state));
	},

	async callbackMicrosoft(ctx: Context) {
		try {
			verifyState(ctx, "ms");

			const code = ctx.req.query("code");
			if (!code) throw new BadRequestError('Missing "code" query parameter');

			const tokens = await exchangeMsAuthorizationCode(msOAuthConfig, code);
			await tokenStore.save({ provider: "MICROSOFT", ...tokens });
		} catch (error) {
			const message = error instanceof Error ? error.message : "OAuth failed";
			return connectionsRedirect(ctx, { error: message, provider: "microsoft" });
		}

		return connectionsRedirect(ctx, { connected: "microsoft" });
	},
};
