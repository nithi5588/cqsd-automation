"use client";
import { useEffect, useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

const COLLAPSE_STORAGE_KEY = "cqsd_sidebar_collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	const [collapsed, setCollapsed] = useState(false);

	// Read the saved preference after mount only — matches SSR's uncollapsed
	// render first, then flips, rather than risking a hydration mismatch.
	useEffect(() => {
		if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1") setCollapsed(true);
	}, []);

	const toggleCollapsed = () => {
		setCollapsed((prev) => {
			const next = !prev;
			localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
			return next;
		});
	};

	return (
		<div className="flex min-h-screen bg-bg">
			{/* sticky rail occupies real width on desktop (pushes content); drawer on mobile */}
			<Sidebar open={open} onClose={() => setOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar onMenu={() => setOpen(true)} />
				<main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">{children}</main>
			</div>
			<CommandPalette />
		</div>
	);
}
