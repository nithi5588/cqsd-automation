import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/cn";
import { compact, num } from "@/lib/format";
import type { Kpi } from "@/types/ui";
import { GlassCard } from "./glass";
import { Sparkline } from "./sparkline";

function display(k: Kpi): string {
	if (k.currency) return `$${compact(k.value)}`;
	const n = num(k.value);
	if (!k.unit) return n;
	return k.unit === "%" ? `${n}%` : `${n} ${k.unit}`;
}

export function KpiTile({ kpi, className }: { kpi: Kpi; className?: string }) {
	const dir = kpi.deltaDir ?? "flat";
	const DeltaIcon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
	const deltaColor =
		dir === "up" ? "text-[var(--delta-up)]" : dir === "down" ? "text-[var(--delta-down)]" : "text-faint";

	return (
		<GlassCard className={cn("relative overflow-hidden p-3.5", className)}>
			<div className="flex items-start justify-between gap-2">
				<p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{kpi.label}</p>
				{kpi.delta !== undefined && (
					<span className={cn("tnum inline-flex items-center gap-0.5 text-xs font-medium", deltaColor)}>
						<DeltaIcon size={12} />
						{kpi.delta}%
					</span>
				)}
			</div>
			<div className="mt-1.5 flex items-end justify-between gap-2">
				<p className="tnum text-[22px] font-semibold leading-7 tracking-tight text-fg">{display(kpi)}</p>
				{kpi.spark && <Sparkline data={kpi.spark} width={72} height={22} className="text-brand" />}
			</div>
			{kpi.hint && <p className="mt-1 text-[11px] text-faint">{kpi.hint}</p>}
		</GlassCard>
	);
}
