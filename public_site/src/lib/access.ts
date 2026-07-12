import type { UserRole } from "@/types";

export const ROLE_LABEL: Record<UserRole, string> = {
	ADMIN: "Admin",
	MEMBER: "Member",
};

const ADMIN_ONLY_PREFIXES = ["/admin"];

/** MEMBER can reach everything except admin-only sections; ADMIN can reach everything. */
export function canAccess(pathname: string, role: UserRole): boolean {
	if (role === "ADMIN") return true;
	return !ADMIN_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function homeFor(_role: UserRole): string {
	return "/";
}
