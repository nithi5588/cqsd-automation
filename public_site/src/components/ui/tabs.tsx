"use client";

import { cn } from "@/lib/cn";

export interface SegItem<T extends string> {
	value: T;
	label: string;
	icon?: React.ReactNode;
	count?: number;
}

export function Segmented<T extends string>({
	items,
	value,
	onChange,
	size = "md",
	className,
}: {
	items: SegItem<T>[];
	value: T;
	onChange: (v: T) => void;
	size?: "sm" | "md";
	className?: string;
}) {
	return (
		<div
			className={cn("inline-flex items-center gap-0.5 rounded-full border border-hairline bg-fg/[0.03] p-0.5", className)}
			role="tablist"
		>
			{items.map((it) => {
				const active = it.value === value;
				return (
					<button
						key={it.value}
						role="tab"
						aria-selected={active}
						onClick={() => onChange(it.value)}
						className={cn(
							"inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
							size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-[13px]",
							active
								? "bg-[var(--glass-strong)] text-fg shadow-[0_1px_2px_rgba(16,24,40,0.1)]"
								: "text-muted hover:text-fg",
						)}
					>
						{it.icon}
						{it.label}
						{it.count !== undefined && (
							<span
								className={cn(
									"tnum rounded-full px-1.5 text-[10px] leading-4",
									active ? "bg-[var(--accent-soft)] text-muted" : "bg-fg/[0.05] text-faint",
								)}
							>
								{it.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
