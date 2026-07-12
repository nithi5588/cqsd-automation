import { cn } from "@/lib/cn";

export function Avatar({
	initials,
	size = 36,
	className,
	online,
}: {
	initials: string;
	size?: number;
	className?: string;
	online?: boolean;
}) {
	return (
		<span className="relative inline-flex shrink-0">
			<span
				className={cn(
					"grid place-items-center rounded-full border border-hairline bg-[var(--accent-soft)] font-semibold text-brand",
					className,
				)}
				style={{ width: size, height: size, fontSize: size * 0.36 }}
			>
				{initials}
			</span>
			{online !== undefined && (
				<span
					className={cn(
						"absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--bg)]",
						online ? "bg-[var(--ok)]" : "bg-faint",
					)}
				/>
			)}
		</span>
	);
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
	return <div style={style} className={cn("animate-pulse rounded-md bg-[#eef0f3] dark:bg-[#232b35]", className)} />;
}

export function Spinner({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
				className,
			)}
		/>
	);
}

export function EmptyState({
	icon,
	title,
	hint,
	className,
}: {
	icon?: React.ReactNode;
	title: string;
	hint?: string;
	className?: string;
}) {
	return (
		<div className={cn("grid place-items-center gap-1.5 px-6 py-10 text-center", className)}>
			{icon && <div className="text-faint [&_svg]:h-5 [&_svg]:w-5">{icon}</div>}
			<p className="text-[13px] font-medium text-fg">{title}</p>
			{hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
		</div>
	);
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
	return (
		<div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[var(--accent-soft)]", className)}>
			<div
				className="h-full rounded-full bg-accent"
				style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
			/>
		</div>
	);
}
