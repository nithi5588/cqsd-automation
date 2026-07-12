"use client";

import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";

type Opt = { value: string; label: string };

const filterShell =
	"inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-[var(--glass-strong)] pl-2.5 pr-1 text-[13px]";

/** Compact labelled dropdown for structured list filters (industry, persona, status…). */
export function FilterSelect({
	label,
	value,
	onChange,
	options,
	className,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
	options: (string | Opt)[];
	className?: string;
}) {
	const opts: Opt[] = options.map((o) => (typeof o === "string" ? { value: o, label: titleCase(o) } : o));
	return (
		<label className={cn(filterShell, className)}>
			<span className="text-xs text-faint">{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-full max-w-40 cursor-pointer appearance-none bg-transparent pr-4 text-[13px] font-medium text-fg outline-none"
			>
				<option value="">All</option>
				{opts.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</label>
	);
}

export type RangeKey = "all" | "today" | "7d" | "30d" | "90d";
const RANGE_DAYS: Record<RangeKey, number | null> = { all: null, today: 0, "7d": 7, "30d": 30, "90d": 90 };
const RANGE_LABEL: Record<RangeKey, string> = {
	all: "All time",
	today: "Today",
	"7d": "7 days",
	"30d": "30 days",
	"90d": "90 days",
};

export function inRange(iso: string, key: RangeKey): boolean {
	const days = RANGE_DAYS[key];
	if (days === null) return true;
	const now = Date.now();
	if (days === 0) return iso.slice(0, 10) === new Date(now).toISOString().slice(0, 10);
	return new Date(iso).getTime() >= now - days * 86_400_000;
}

export function RangeSelect({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
	return (
		<label className={filterShell}>
			<span className="text-xs text-faint">Range</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as RangeKey)}
				className="h-full cursor-pointer appearance-none bg-transparent pr-4 text-[13px] font-medium text-fg outline-none"
			>
				{(Object.keys(RANGE_LABEL) as RangeKey[]).map((k) => (
					<option key={k} value={k}>
						{RANGE_LABEL[k]}
					</option>
				))}
			</select>
		</label>
	);
}
