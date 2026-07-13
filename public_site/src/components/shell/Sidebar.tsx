"use client";
import { ChevronLeft, ChevronRight, LogOut, X } from "lucide-react";
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

export function Sidebar({
	open,
	onClose,
	collapsed,
	onToggleCollapsed,
}: {
	open: boolean;
	onClose: () => void;
	collapsed: boolean;
	onToggleCollapsed: () => void;
}) {
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
					"fixed top-0 z-50 flex h-screen max-w-[84vw] shrink-0 flex-col border-r border-hairline bg-[var(--glass-strong)] transition-[width,transform] duration-200",
					"lg:sticky lg:z-30 lg:translate-x-0 lg:self-start",
					collapsed ? "lg:w-[72px]" : "lg:w-[224px]",
					"w-[224px]",
					open ? "translate-x-0" : "-translate-x-full",
				)}
			>
				{/* collapse/expand toggle — floats on the sidebar's trailing edge, desktop only */}
				<button
					type="button"
					onClick={onToggleCollapsed}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					className="absolute -right-3 top-16 z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-hairline bg-[var(--card)] text-faint shadow-[var(--shadow-card)] transition-colors hover:text-brand lg:grid"
				>
					{collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
				</button>

				{/* brand row */}
				<div
					className={cn(
						"flex h-16 shrink-0 items-center gap-2 border-b border-hairline",
						collapsed ? "justify-center px-2" : "px-3",
					)}
				>
					{!collapsed && (
						<Link href="/" className="flex min-w-0 items-center gap-2" title="CompQsoft Digital">
							{/* white chip in dark mode so the wordmark stays legible; bare in light */}
							<span className="flex shrink-0 items-center rounded-md dark:bg-white dark:px-1.5 dark:py-1 dark:ring-1 dark:ring-black/10">
								<img src="/logo.png" alt="CompQsoft Digital" className="h-8 w-auto object-contain" />
							</span>
						</Link>
					)}
					{collapsed && (
						<Link
							href="/"
							title="CompQsoft Digital"
							className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--accent-soft)] text-sm font-black text-brand"
						>
							Q
						</Link>
					)}
					<button
						type="button"
						onClick={onClose}
						className={cn(
							"grid h-7 w-7 shrink-0 place-items-center rounded-md text-faint transition-colors hover:text-fg lg:hidden",
							collapsed ? "" : "ml-auto",
						)}
						aria-label="Close"
					>
						<X size={16} />
					</button>
				</div>

				{/* nav */}
				<nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
					{groups.map((g) => (
						<div key={g.title} className="pb-3">
							{!collapsed && (
								<p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
									{g.title}
								</p>
							)}
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
													"relative flex h-9 items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors",
													collapsed ? "justify-center px-0" : "px-2.5",
													active
														? "bg-[var(--accent-soft)] text-brand"
														: "text-muted hover:bg-[var(--fg)]/[0.045] hover:text-fg",
												)}
											>
												{active && (
													<span
														aria-hidden
														className={cn(
															"absolute top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-brand",
															collapsed ? "left-1" : "left-0",
														)}
													/>
												)}
												<span
													className={cn(
														"grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors",
														active ? "bg-[var(--card)] text-brand shadow-[var(--shadow-card)]" : "text-faint",
													)}
												>
													{it.icon}
												</span>
												{!collapsed && <span className="truncate">{it.label}</span>}
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
					{collapsed ? (
						<div className="flex flex-col items-center gap-2">
							<Avatar initials={initialsFor(user?.email)} size={28} />
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
					) : (
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
					)}
				</div>
			</aside>
		</>
	);
}
