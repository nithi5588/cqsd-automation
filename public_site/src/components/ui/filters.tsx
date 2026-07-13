"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { titleCase } from "@/lib/format";
import { Popover } from "./popover";

type Opt = { value: string; label: string };

const filterShell =
	"inline-flex h-8 items-center gap-1.5 rounded-full border border-hairline bg-[var(--glass-strong)] pl-3 pr-1.5 text-[13px]";

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

/**
 * Checkbox multi-select filter: search box, scrollable checkbox list, and an
 * Apply/Clear-selected footer — selection is staged locally and only committed
 * (via `onApply`) when Apply is pressed, so opening the panel never fires a
 * fetch until the user actually confirms a change.
 */
export function MultiSelectFilter({
	label,
	options,
	selected,
	onApply,
	className,
}: {
	label: string;
	options: string[];
	selected: string[];
	onApply: (values: string[]) => void;
	className?: string;
}) {
	const [pending, setPending] = useState(selected);
	const [search, setSearch] = useState("");

	// Re-sync staged selection whenever the committed selection changes elsewhere
	// (e.g. a "clear all filters" action outside this component).
	useEffect(() => setPending(selected), [selected]);

	const filtered = search.trim()
		? options.filter((o) => o.toLowerCase().includes(search.trim().toLowerCase()))
		: options;

	function toggle(value: string) {
		setPending((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
	}

	return (
		<Popover
			align="start"
			width={260}
			trigger={({ toggle: togglePanel }) => (
				<button type="button" onClick={togglePanel} className={cn(filterShell, "pr-2.5", className)}>
					<span className="text-xs text-faint">{label}</span>
					{selected.length > 0 ? (
						<span className="tnum rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[11px] font-semibold text-brand">
							{selected.length}
						</span>
					) : (
						<span className="text-[13px] font-medium text-muted">All</span>
					)}
					<ChevronDown size={13} className="text-faint" />
				</button>
			)}
		>
			{(close) => (
				<div className="flex max-h-96 flex-col">
					<div className="flex items-center gap-2 border-b border-hairline px-2.5 py-2">
						<Search size={13} className="shrink-0 text-faint" />
						<input
							autoFocus
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Search values"
							className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
						/>
					</div>
					<ul className="max-h-56 overflow-y-auto p-1.5">
						{filtered.length === 0 && (
							<li className="px-2.5 py-4 text-center text-xs text-faint">No matches</li>
						)}
						{filtered.map((option) => {
							const checked = pending.includes(option);
							return (
								<li key={option}>
									<label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] hover:bg-[var(--accent-soft)]">
										<input
											type="checkbox"
											checked={checked}
											onChange={() => toggle(option)}
											className="h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
										/>
										<span className="truncate text-fg">{option}</span>
									</label>
								</li>
							);
						})}
					</ul>
					<div className="flex items-center justify-between gap-2 border-t border-hairline px-3 py-2">
						<span className="text-xs text-muted">Selected: {pending.length}</span>
						<button
							type="button"
							onClick={() => setPending([])}
							className="text-xs font-medium text-brand hover:underline"
						>
							Clear selected
						</button>
					</div>
					<button
						type="button"
						onClick={() => {
							onApply(pending);
							close();
						}}
						className="m-1.5 mt-0 rounded-lg bg-accent py-2 text-[13px] font-semibold text-accent-fg shadow-[var(--shadow-glow)] transition hover:bg-accent-hover"
					>
						Apply
					</button>
				</div>
			)}
		</Popover>
	);
}
