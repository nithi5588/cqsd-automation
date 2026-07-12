"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

function useEscClose(open: boolean, onClose: () => void) {
	useEffect(() => {
		if (!open) return;
		const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		document.addEventListener("keydown", onEsc);
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onEsc);
			document.body.style.overflow = "";
		};
	}, [open, onClose]);
}

/* Self-contained 120ms entrance keyframes (fade + slight scale, no blur). */
const overlayKeyframes =
	"@keyframes cq-fade-in{from{opacity:0}to{opacity:1}}" +
	"@keyframes cq-scale-in{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}";

const panelSurface =
	"border border-hairline bg-[var(--glass-strong)] shadow-[0_12px_32px_rgba(16,24,40,0.18)]";

const sizes = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({
	open,
	onClose,
	title,
	subtitle,
	children,
	footer,
	size = "md",
}: {
	open: boolean;
	onClose: () => void;
	title?: string;
	subtitle?: string;
	children: React.ReactNode;
	footer?: React.ReactNode;
	size?: keyof typeof sizes;
}) {
	useEscClose(open, onClose);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[90] grid place-items-center p-4">
			<style>{overlayKeyframes}</style>
			<button
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 bg-[rgba(16,24,40,0.4)]"
				style={{ animation: "cq-fade-in 120ms ease-out" }}
			/>
			<div
				className={cn("relative z-10 w-full rounded-[10px]", panelSurface, sizes[size])}
				style={{ animation: "cq-scale-in 120ms ease-out" }}
			>
				<div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
					<div>
						{title && <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>}
						{subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
					</div>
					<button
						onClick={onClose}
						className="rounded-md p-1 text-faint hover:bg-[var(--accent-soft)] hover:text-fg"
						aria-label="Close"
					>
						<X size={16} />
					</button>
				</div>
				<div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
				{footer && <div className="flex justify-end gap-2 border-t border-hairline px-4 py-3">{footer}</div>}
			</div>
		</div>
	);
}

/** Right-side drawer — used for detail views (activity drill-down, contact detail). */
export function Sheet({
	open,
	onClose,
	title,
	subtitle,
	children,
	width = 440,
}: {
	open: boolean;
	onClose: () => void;
	title?: string;
	subtitle?: string;
	children: React.ReactNode;
	width?: number;
}) {
	useEscClose(open, onClose);
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[90]">
			<style>{overlayKeyframes}</style>
			<button
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 bg-[rgba(16,24,40,0.4)]"
				style={{ animation: "cq-fade-in 120ms ease-out" }}
			/>
			<div
				className={cn("absolute right-0 top-0 flex h-full w-full flex-col", panelSurface)}
				style={{ maxWidth: width, animation: "cq-fade-in 120ms ease-out" }}
			>
				<div className="flex items-start justify-between gap-4 border-b border-hairline px-4 py-3.5">
					<div>
						{title && <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>}
						{subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
					</div>
					<button
						onClick={onClose}
						className="rounded-md p-1 text-faint hover:bg-[var(--accent-soft)] hover:text-fg"
						aria-label="Close"
					>
						<X size={16} />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto p-4">{children}</div>
			</div>
		</div>
	);
}
