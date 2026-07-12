import type { Context, Next } from "hono";
import { ForbiddenError, UnauthorizedError } from "../http/errors";
import { type AccessClaims, type UserRole, verifyAccessJwt } from "./jwt";

declare module "hono" {
	interface ContextVariableMap {
		authUser: AccessClaims;
	}
}

export interface AuthMiddlewareOptions {
	secret: string;
	issuer: string;
	audience: string;
	/** When set, only this role may pass — otherwise any authenticated user does. */
	requiredRole?: UserRole;
}

/**
 * Verifies the bearer JWT and stores the decoded claims on `ctx.get("authUser")`.
 * Throws `HttpError` subclasses instead of returning a response directly, so the
 * app's single `onError` handler is what shapes the final JSON body.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions) {
	return async (ctx: Context, next: Next) => {
		const header = ctx.req.header("Authorization");
		if (!header?.startsWith("Bearer ")) {
			throw new UnauthorizedError("Missing bearer token");
		}

		const token = header.slice("Bearer ".length);

		let claims: AccessClaims;
		try {
			claims = await verifyAccessJwt({
				token,
				secret: options.secret,
				issuer: options.issuer,
				audience: options.audience,
			});
		} catch {
			throw new UnauthorizedError("Invalid or expired token");
		}

		if (options.requiredRole && claims.role !== options.requiredRole) {
			throw new ForbiddenError("Insufficient role");
		}

		ctx.set("authUser", claims);
		await next();
	};
}
