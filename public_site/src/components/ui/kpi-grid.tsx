import type { Kpi } from "@/types/ui";
import { KpiTile } from "./kpi";
import { Skeleton } from "./misc";

/** Responsive KPI row with skeleton loading state. */
export function KpiGrid({ kpis, loading, count = 6 }: { kpis?: Kpi[]; loading?: boolean; count?: number }) {
	return (
		<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
			{loading || !kpis
				? Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-[88px]" />)
				: kpis.map((k) => <KpiTile key={k.key} kpi={k} />)}
		</div>
	);
}
