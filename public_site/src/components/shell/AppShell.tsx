"use client";
import { useState } from "react";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
	const [open, setOpen] = useState(false);
	return (
		<div className="flex min-h-screen bg-bg">
			{/* sticky rail occupies real width on desktop (pushes content); drawer on mobile */}
			<Sidebar open={open} onClose={() => setOpen(false)} />
			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar onMenu={() => setOpen(true)} />
				<main className="mx-auto w-full max-w-[1400px] px-4 py-5 sm:px-6">{children}</main>
			</div>
			<CommandPalette />
		</div>
	);
}
