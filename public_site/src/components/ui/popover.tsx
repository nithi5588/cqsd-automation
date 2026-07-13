"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** Lightweight click-away popover. Trigger is any element; content is an elevated flat panel. */
export function Popover({
	trigger,
	children,
	align = "end",
	className,
	wrapperClassName,
	width = 260,
}: {
	trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
	children: (close: () => void) => React.ReactNode;
	align?: "start" | "end";
	className?: string;
	wrapperClassName?: string;
	width?: number | string;
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
		};
		const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onEsc);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onEsc);
		};
	}, [open]);

	return (
		<div ref={ref} className={cn("relative inline-flex", wrapperClassName)}>
			{trigger({ open, toggle: () => setOpen((o) => !o) })}
			{open && (
				<div
					className={cn(
						"absolute top-[calc(100%+6px)] z-50 rounded-2xl border border-hairline bg-[var(--glass-strong)] p-1 shadow-[var(--shadow-overlay)]",
						align === "end" ? "right-0" : "left-0",
						className,
					)}
					style={{ width }}
				>
					{children(() => setOpen(false))}
				</div>
			)}
		</div>
	);
}

/* ---- menu list: plain hover styles (no animation dependency) -------- */

export function MenuList({ children, className }: { children: React.ReactNode; className?: string }) {
	return <div className={className}>{children}</div>;
}

export function MenuItem({
	children,
	onClick,
	danger,
	icon,
}: {
	children: React.ReactNode;
	onClick?: () => void;
	danger?: boolean;
	icon?: React.ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-medium",
				"transition-colors hover:bg-[var(--accent-soft)]",
				danger ? "text-[var(--danger)]" : "text-fg",
			)}
		>
			{icon}
			{children}
		</button>
	);
}
