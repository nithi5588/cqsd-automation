"use client";
import { LogOut, Menu, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/ui/misc";
import { MenuItem, MenuList, Popover } from "@/components/ui/popover";
import { ROLE_LABEL } from "@/lib/access";

function initialsFor(email: string | undefined): string {
	if (!email) return "?";
	const local = email.split("@")[0] ?? "";
	const parts = local.split(/[._-]+/).filter(Boolean);
	if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
	return local.slice(0, 2).toUpperCase() || "?";
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
	const router = useRouter();
	const { user, logout } = useAuth();
	const roleLabel = ROLE_LABEL[user?.role ?? "MEMBER"];
	const displayName = user?.email.split("@")[0] ?? "Account";

	return (
		<header className="sticky top-0 z-40 flex h-[52px] items-center gap-3 border-b border-hairline bg-[var(--glass-strong)] px-4">
			<button
				type="button"
				onClick={onMenu}
				className="grid h-8 w-8 place-items-center rounded-md text-muted transition-colors hover:text-fg lg:hidden"
				aria-label="Open menu"
			>
				<Menu size={18} />
			</button>

			<button
				type="button"
				onClick={() => window.dispatchEvent(new CustomEvent("cqsd:cmdk"))}
				className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-hairline px-2.5 text-[13px] text-muted transition-colors hover:bg-[var(--fg)]/[0.03] sm:max-w-64"
			>
				<Search size={15} className="text-faint" />
				<span className="flex-1 text-left">Search…</span>
				<kbd className="hidden rounded border border-hairline px-1 py-px text-[10px] text-faint sm:block">⌘K</kbd>
			</button>

			<div className="ml-auto flex items-center gap-1.5">
				<ThemeToggle />

				<Popover
					width={240}
					trigger={({ toggle }) => (
						<button
							type="button"
							onClick={toggle}
							className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-[var(--fg)]/[0.045]"
						>
							<Avatar initials={initialsFor(user?.email)} size={26} />
							<span className="hidden text-left leading-tight sm:block">
								<span className="block max-w-28 truncate text-[12px] font-medium">{displayName}</span>
								<span className="block text-[10.5px] text-faint">{roleLabel}</span>
							</span>
						</button>
					)}
				>
					{(close) => (
						<MenuList>
							<div className="px-2.5 py-2">
								<p className="truncate text-[12.5px] font-semibold text-fg">{user?.email}</p>
								<p className="text-[11px] text-faint">{roleLabel}</p>
							</div>
							<div className="my-1 h-px bg-hairline" />
							<MenuItem
								icon={<LogOut size={16} />}
								danger
								onClick={() => {
									close();
									logout();
									router.push("/login");
								}}
							>
								Log out
							</MenuItem>
						</MenuList>
					)}
				</Popover>
			</div>
		</header>
	);
}
