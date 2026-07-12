import { apiEnv } from "@cqsd/config";
import { type UserRole, createAuthMiddleware } from "@cqsd/shared/auth";

/** Bakes in this service's JWT secret/issuer/audience so routes just say `requireAuth()` or `requireAuth("ADMIN")`. */
export function requireAuth(requiredRole?: UserRole) {
	return createAuthMiddleware({
		secret: apiEnv.JWT_SECRET,
		issuer: apiEnv.JWT_ISSUER,
		audience: apiEnv.JWT_AUDIENCE,
		requiredRole,
	});
}
