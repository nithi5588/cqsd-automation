import { sign, verify } from "hono/jwt";

export type UserRole = "ADMIN" | "MEMBER";

export interface AccessClaims {
	sub: string;
	email: string;
	role: UserRole;
	iss: string;
	aud: string;
	iat: number;
	exp: number;
	[claim: string]: unknown;
}

/** Dashboard sessions are short-lived JWTs; there is no refresh-token flow for phase 0. */
const ACCESS_TTL_SECONDS = 60 * 60 * 12;

export interface SignAccessJwtOptions {
	userId: string;
	email: string;
	role: UserRole;
	secret: string;
	issuer: string;
	audience: string;
}

export async function signAccessJwt(options: SignAccessJwtOptions): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload: AccessClaims = {
		sub: options.userId,
		email: options.email,
		role: options.role,
		iss: options.issuer,
		aud: options.audience,
		iat: now,
		exp: now + ACCESS_TTL_SECONDS,
	};
	return sign(payload, options.secret, "HS256");
}

export interface VerifyAccessJwtOptions {
	token: string;
	secret: string;
	issuer: string;
	audience: string;
}

export async function verifyAccessJwt(options: VerifyAccessJwtOptions): Promise<AccessClaims> {
	const decoded = (await verify(options.token, options.secret, "HS256")) as unknown as AccessClaims;
	if (decoded.iss !== options.issuer) throw new Error("Invalid token issuer");
	if (decoded.aud !== options.audience) throw new Error("Invalid token audience");
	return decoded;
}
