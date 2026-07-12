/** Shared UI primitives used by KPI tiles, sparklines and charts. */

/** A single point on a time-series (used by line/area charts). */
export interface TrendPoint {
	/** ISO date ("YYYY-MM-DD" or full timestamp) */
	date: string;
	value: number;
	/** optional second measure for dual-series charts */
	value2?: number;
}

/** Named numeric datum for bar / donut / ranking charts. */
export interface NameValue {
	name: string;
	value: number;
}

export type DeltaDir = "up" | "down" | "flat";

/** A KPI/stat tile. `delta` is percent change vs the comparison period. */
export interface Kpi {
	key: string;
	label: string;
	value: number;
	/** "%", "min", "" … rendered after/around the value */
	unit?: string;
	/** currency values get compact "$" formatting when true */
	currency?: boolean;
	delta?: number;
	deltaDir?: DeltaDir;
	/** small inline sparkline */
	spark?: number[];
	hint?: string;
}
