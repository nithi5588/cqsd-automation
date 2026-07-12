import { cn } from "@/lib/cn";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

/** Flat bordered card — the default surface. */
export function GlassCard({ className, ...props }: DivProps) {
	return (
		<div
			className={cn(
				"rounded-[10px] border border-hairline bg-[var(--glass-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
				className,
			)}
			{...props}
		/>
	);
}

/** Opaque surface for primary containers (sidebar, modals, toolbars). */
export function GlassPanel({ className, ...props }: DivProps) {
	return (
		<div
			className={cn(
				"rounded-[10px] border border-hairline bg-[var(--glass-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
				className,
			)}
			{...props}
		/>
	);
}

export function SectionTitle({
	title,
	subtitle,
	right,
	className,
}: {
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-end justify-between gap-4", className)}>
			<div>
				<h2 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h2>
				{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
			</div>
			{right}
		</div>
	);
}
