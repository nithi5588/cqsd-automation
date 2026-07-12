"use client";
import { LogOut, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Avatar } from "@/components/ui/misc";
import { NAV, navVisible } from "@/config/nav";
import { ROLE_LABEL } from "@/lib/access";
import { cn } from "@/lib/cn";

function isActive(pathname: string, href: string) {
	const depth = href.split("/").filter(Boolean).length;
	if (depth <= 1) return pathname === href;
	return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFor(email: string | undefined): string {
	if (!email) return "?";
	const local = email.split("@")[0] ?? "";
	const parts = local.split(/[._-]+/).filter(Boolean);
	if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
	return local.slice(0, 2).toUpperCase() || "?";
}

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
	const pathname = usePathname();
	const router = useRouter();
	const { user, logout } = useAuth();

	const role = user?.role ?? "MEMBER";

	const groups = NAV.map((g) => ({
		...g,
		items: g.items.filter((it) => navVisible(it, role)),
	})).filter((g) => g.items.length > 0);

	const signOut = () => {
		logout();
		router.push("/login");
	};

	return (
		<>
			{open && (
				<button
					type="button"
					aria-label="Close menu"
					onClick={onClose}
					className="fixed inset-0 z-40 bg-black/45 lg:hidden"
				/>
			)}
			<aside
				className={cn(
					"fixed top-0 z-50 flex h-screen w-[224px] max-w-[84vw] shrink-0 flex-col border-r border-hairline bg-[var(--glass-strong)] transition-transform duration-150",
					"lg:sticky lg:z-30 lg:translate-x-0 lg:self-start",
					open ? "translate-x-0" : "-translate-x-full",
				)}
			>
				{/* brand row */}
				<div className="flex h-16 shrink-0 items-center gap-2 border-b border-hairline px-3">
					<Link href="/" className="flex min-w-0 items-center gap-2" title="CompQsoft Digital">
						{/* white chip in dark mode so the wordmark stays legible; bare in light */}
						<span className="flex shrink-0 items-center rounded-md dark:bg-white dark:px-1.5 dark:py-1 dark:ring-1 dark:ring-black/10">
							<img src="/logo.png" alt="CompQsoft Digital" className="h-8 w-auto object-contain" />
						</span>
					</Link>
					<button
						type="button"
						onClick={onClose}
						className="ml-auto grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:text-fg lg:hidden"
						aria-label="Close"
					>
						<X size={16} />
					</button>
				</div>

				{/* nav */}
				<nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
					{groups.map((g) => (
						<div key={g.title} className="pb-3">
							<p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
								{g.title}
							</p>
							<ul className="space-y-0.5">
								{g.items.map((it) => {
									const active = isActive(pathname, it.href);
									return (
										<li key={it.href}>
											<Link
												href={it.href}
												onClick={onClose}
												title={it.label}
												aria-current={active ? "page" : undefined}
												className={cn(
													"relative flex h-8 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors",
													active
														? "bg-[var(--accent-soft)] text-brand"
														: "text-muted hover:bg-[var(--fg)]/[0.045] hover:text-fg",
												)}
											>
												{active && (
													<span
														aria-hidden
														className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand"
													/>
												)}
												<span className={cn("shrink-0", active ? "text-brand" : "text-faint")}>{it.icon}</span>
												<span className="truncate">{it.label}</span>
											</Link>
										</li>
									);
								})}
							</ul>
						</div>
					))}
				</nav>

				{/* footer · user chip + logout */}
				<div className="shrink-0 border-t border-hairline p-3">
					<div className="flex items-center gap-2">
						<Avatar initials={initialsFor(user?.email)} size={28} />
						<div className="min-w-0 flex-1 leading-tight">
							<p className="truncate text-[12px] font-medium text-fg">{user?.email}</p>
							<p className="truncate text-[10.5px] text-faint">{ROLE_LABEL[role]}</p>
						</div>
						<button
							type="button"
							onClick={signOut}
							className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-[var(--fg)]/[0.045] hover:text-[var(--danger)]"
							aria-label="Sign out"
							title="Sign out"
						>
							<LogOut size={16} />
						</button>
					</div>
				</div>
			</aside>
		</>
	);
}
