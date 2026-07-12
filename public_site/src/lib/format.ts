export function fmtDate(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function fmtDateTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(date);
}

export function fromNow(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	const diffMinutes = Math.round((date.getTime() - Date.now()) / 60_000);
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

	if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, "minute");
	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) return rtf.format(diffHours, "hour");
	return rtf.format(Math.round(diffHours / 24), "day");
}

export function titleCase(value: string): string {
	return value
		.toLowerCase()
		.split(/[\s_-]+/)
		.map((word) => (word.length > 0 ? word[0]?.toUpperCase() + word.slice(1) : word))
		.join(" ");
}

export function num(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

const trimZero = (s: string): string => s.replace(/\.0$/, "");

/** Compact US-style number: 950 → "950", 1_240 → "1.2k", 3_400_000 → "3.4M". */
export function compact(value: number): string {
	const abs = Math.abs(value);
	if (abs >= 1e9) return `${trimZero((value / 1e9).toFixed(1))}B`;
	if (abs >= 1e6) return `${trimZero((value / 1e6).toFixed(1))}M`;
	if (abs >= 1e3) return `${trimZero((value / 1e3).toFixed(1))}k`;
	return num(value);
}

/** Ratio (0–1) → percent label: 0.425 → "42%", 0.075 → "7.5%". */
export function pct(value: number): string {
	const v = value * 100;
	if (!Number.isFinite(v)) return "0%";
	const rounded = Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v);
	return `${rounded}%`;
}

/** Seconds → "1h 12m" / "12m 30s" / "45s". */
export function dur(seconds: number): string {
	if (!Number.isFinite(seconds) || seconds <= 0) return "0s";
	const total = Math.round(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
	if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
	return `${s}s`;
}
