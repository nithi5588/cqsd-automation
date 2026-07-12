"use client";
import { LogOut, Moon, Search, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { NAV, navVisible } from "@/config/nav";
import { cn } from "@/lib/cn";

interface Cmd {
	id: string;
	label: string;
	group: string;
	icon?: React.ReactNode;
	run: () => void;
}

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const [q, setQ] = useState("");
	const [sel, setSel] = useState(0);
	const router = useRouter();
	const { setTheme, resolvedTheme } = useTheme();
	const { user, logout } = useAuth();
	const role = user?.role ?? "MEMBER";

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
				e.preventDefault();
				setOpen((o) => !o);
			}
			if (e.key === "Escape") setOpen(false);
		};
		const onEvt = () => setOpen(true);
		window.addEventListener("keydown", onKey);
		window.addEventListener("cqsd:cmdk", onEvt);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("cqsd:cmdk", onEvt);
		};
	}, []);

	const commands = useMemo<Cmd[]>(() => {
		const navCmds: Cmd[] = NAV.flatMap((g) =>
			g.items
				.filter((it) => navVisible(it, role))
				.map((it) => ({
					id: it.href,
					label: it.label,
					group: g.title,
					icon: it.icon,
					run: () => router.push(it.href),
				})),
		);
		const actions: Cmd[] = [
			{
				id: "theme",
				label: resolvedTheme === "light" ? "Switch to dark mode" : "Switch to light mode",
				group: "Actions",
				icon: resolvedTheme === "light" ? <Moon size={16} /> : <Sun size={16} />,
				run: () => setTheme(resolvedTheme === "light" ? "dark" : "light"),
			},
			{
				id: "logout",
				label: "Log out",
				group: "Actions",
				icon: <LogOut size={16} />,
				run: () => {
					logout();
					router.push("/login");
				},
			},
		];
		return [...navCmds, ...actions];
	}, [role, resolvedTheme, router, setTheme, logout]);

	const filtered = useMemo(
		() => commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase())),
		[commands, q],
	);

	useEffect(() => setSel(0), [q, open]);
	if (!open) return null;

	const runAt = (i: number) => {
		const c = filtered[i];
		if (c) {
			c.run();
			setOpen(false);
			setQ("");
		}
	};

	return (
		<div className="fixed inset-0 z-[95] grid place-items-start justify-center p-4 pt-[12vh] transition-opacity duration-[120ms] starting:opacity-0">
			<button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
			<div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[10px] border border-hairline bg-[var(--glass-strong)] shadow-[0_12px_32px_rgba(16,24,40,0.18)]">
				<div className="flex items-center gap-2.5 border-b border-hairline px-3.5">
					<Search size={16} className="text-faint" />
					<input
						autoFocus
						value={q}
						onChange={(e) => setQ(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "ArrowDown") {
								e.preventDefault();
								setSel((s) => Math.min(s + 1, filtered.length - 1));
							}
							if (e.key === "ArrowUp") {
								e.preventDefault();
								setSel((s) => Math.max(s - 1, 0));
							}
							if (e.key === "Enter") {
								e.preventDefault();
								runAt(sel);
							}
						}}
						placeholder="Search pages and actions…"
						className="h-11 w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
					/>
					<kbd className="rounded border border-hairline px-1 py-px text-[10px] text-faint">ESC</kbd>
				</div>
				<ul className="max-h-80 overflow-y-auto p-1.5">
					{filtered.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No results</li>}
					{filtered.map((c, i) => (
						<li key={c.id}>
							<button
								type="button"
								onMouseEnter={() => setSel(i)}
								onClick={() => runAt(i)}
								className={cn(
									"flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px]",
									i === sel ? "bg-[var(--accent-soft)] text-fg" : "text-fg",
								)}
							>
								<span className={i === sel ? "text-brand" : "text-faint"}>{c.icon}</span>
								<span className="flex-1 truncate">{c.label}</span>
								<span className={cn("text-[11px]", i === sel ? "text-muted" : "text-faint")}>{c.group}</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
