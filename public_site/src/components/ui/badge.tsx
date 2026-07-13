import { cn } from "@/lib/cn";
import { type Tone, statusLabel, statusTone } from "@/lib/status";

const toneClass: Record<Tone, string> = {
	neutral: "bg-fg/[0.055] text-muted",
	ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
	warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
	danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
	info: "bg-[var(--info-soft)] text-[var(--info)]",
};
const dotClass: Record<Tone, string> = {
	neutral: "bg-faint",
	ok: "bg-[var(--ok)]",
	warn: "bg-[var(--warn)]",
	danger: "bg-[var(--danger)]",
	info: "bg-[var(--info)]",
};

export function Badge({
	children,
	tone = "neutral",
	className,
}: {
	children: React.ReactNode;
	tone?: Tone;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-4",
				toneClass[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

/** Status chip with a colored dot; maps any status string to a tone + label. */
export function StatusPill({ status, className }: { status: string; className?: string }) {
	const tone = statusTone(status);
	return (
		<Badge tone={tone} className={className}>
			<span className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} />
			{statusLabel(status)}
		</Badge>
	);
}

export function Dot({ tone = "neutral", pulse }: { tone?: Tone; pulse?: boolean }) {
	return (
		<span className="relative inline-flex h-2 w-2">
			{pulse && (
				<span
					className={cn(
						"absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
						dotClass[tone],
					)}
				/>
			)}
			<span className={cn("relative inline-flex h-2 w-2 rounded-full", dotClass[tone])} />
		</span>
	);
}
