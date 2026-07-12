"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui/misc";
import { canAccess, homeFor } from "@/lib/access";

/**
 * Client-side gate for the (app) route group: waits for auth rehydration,
 * bounces signed-out visitors to /login (preserving the destination) and
 * role-blocks MEMBERs from admin-only sections. The proxy only checks the
 * session cookie's presence — role enforcement lives here.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
	const { user, loading } = useAuth();
	const router = useRouter();
	const pathname = usePathname();

	const allowed = user != null && canAccess(pathname, user.role);

	useEffect(() => {
		if (loading) return;
		if (!user) {
			router.replace(`/login?next=${encodeURIComponent(pathname)}`);
			return;
		}
		if (!canAccess(pathname, user.role)) router.replace(homeFor(user.role));
	}, [loading, user, pathname, router]);

	if (loading || !allowed) {
		return (
			<div className="grid min-h-screen place-items-center bg-bg">
				<div className="flex items-center gap-2.5 text-[13px] text-muted">
					<Spinner /> Loading your workspace…
				</div>
			</div>
		);
	}
	return <>{children}</>;
}
