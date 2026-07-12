/**
 * Chart palette: brand blue (#1B75BC family) is the primary series colour and
 * cyan (#27AAE1 family) the secondary; categorical splits use a small muted,
 * brand-anchored set. Grid, axis, and tooltip values mirror the flat console
 * surface tokens (dashed hairline grid, elevated tooltip card).
 */
export interface ChartColors {
	accent: string;
	brand: string;
	secondary: string;
	ramp: string[];
	/** muted, harmonized hues for categorical splits (donuts / multicolor bars) */
	categorical: string[];
	grid: string;
	axis: string;
	text: string;
	tooltipBg: string;
	tooltipBorder: string;
}

/**
 * Fixed channel hues anchored on the brand blue family — internal constants
 * so charts never depend on CSS vars for data identity.
 */
const SOURCE_PALETTE: Record<string, string> = {
	website: "#1b75bc",
	csv: "#0d9488",
	leadgen: "#7c3aed",
	webinar: "#db2777",
	manual: "#b45309",
	email: "#27aae1",
};

/** Channel colour for a contact/lead source; unknown sources fall back to grey. */
export function sourceColor(name: string, fallback = "#98a2b3"): string {
	return SOURCE_PALETTE[name.toLowerCase()] ?? fallback;
}

export function getChartColors(isDark: boolean): ChartColors {
	return isDark
		? {
				accent: "#3d8fd0",
				brand: "#3d8fd0",
				secondary: "#1e93bd",
				ramp: ["#3d8fd0", "#6fb2e5", "#93c5ec", "#b7d8f2", "#d3e7f7", "#e8f2fb"],
				categorical: ["#3d8fd0", "#1e93bd", "#2dd4bf", "#a78bfa", "#fbbf24", "#fb7185", "#f472b6"],
				grid: "#232b35",
				axis: "#8d96a0",
				text: "#8d96a0",
				tooltipBg: "#1c232c",
				tooltipBorder: "#2a323d",
			}
		: {
				accent: "#1b75bc",
				brand: "#1b75bc",
				secondary: "#27aae1",
				ramp: ["#1b75bc", "#3f8cc9", "#69a6d6", "#93c0e3", "#bcd9ef", "#dfedf8"],
				categorical: ["#1b75bc", "#27aae1", "#0d9488", "#7c3aed", "#b45309", "#be123c", "#db2777"],
				grid: "#eef0f3",
				axis: "#667085",
				text: "#667085",
				tooltipBg: "#ffffff",
				tooltipBorder: "#e4e7ec",
			};
}
