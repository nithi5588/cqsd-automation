import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { compact, num } from "@/lib/format";
import type { Kpi, KpiTone } from "@/types/ui";
import { GlassCard } from "./glass";
import { Sparkline } from "./sparkline";

function display(k: Kpi): string {
	if (k.currency) return `$${compact(k.value)}`;
	const n = num(k.value);
	if (!k.unit) return n;
	return k.unit === "%" ? `${n}%` : `${n} ${k.unit}`;
}

const chipTone: Record<KpiTone, string> = {
	brand: "bg-[var(--accent-soft)] text-brand",
	ok: "bg-[var(--ok-soft)] text-[var(--ok)]",
	warn: "bg-[var(--warn-soft)] text-[var(--warn)]",
	danger: "bg-[var(--danger-soft)] text-[var(--danger)]",
	info: "bg-[var(--info-soft)] text-[var(--info)]",
	neutral: "bg-fg/[0.055] text-muted",
};

const deltaTone: Record<"up" | "down" | "flat", string> = {
	up: "bg-[var(--ok-soft)] text-[var(--ok)]",
	down: "bg-[var(--danger-soft)] text-[var(--danger)]",
	flat: "bg-fg/[0.055] text-faint",
};

export function KpiTile({ kpi, className }: { kpi: Kpi; className?: string }) {
	const dir = kpi.deltaDir ?? "flat";
	const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
	const tone = kpi.tone ?? "brand";

	return (
		<GlassCard className={cn("lift-hover relative overflow-hidden p-4", className)}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					{kpi.icon && (
						<span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", chipTone[tone])}>
							{kpi.icon}
						</span>
					)}
					<p className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{kpi.label}</p>
				</div>
				{kpi.delta !== undefined && (
					<span
						className={cn(
							"tnum inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
							deltaTone[dir],
						)}
					>
						<DeltaIcon size={11} />
						{Math.abs(kpi.delta)}%
					</span>
				)}
			</div>
			<div className="mt-3 flex items-end justify-between gap-2">
				<p className="tnum text-[26px] font-semibold leading-7 tracking-tight text-fg">{display(kpi)}</p>
				{kpi.spark && <Sparkline data={kpi.spark} width={72} height={24} className="text-brand" />}
			</div>
			{kpi.hint && <p className="mt-1.5 text-[11px] text-faint">{kpi.hint}</p>}
		</GlassCard>
	);
}
