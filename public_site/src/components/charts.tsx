"use client";

import { useTheme } from "next-themes";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useMounted } from "@/hooks/useMounted";
import { getChartColors, sourceColor } from "@/lib/chartTheme";
import { cn } from "@/lib/cn";
import { compact, fmtDate, num } from "@/lib/format";
import type { NameValue, TrendPoint } from "@/types/ui";
import { GlassCard } from "./ui/glass";
import { Skeleton } from "./ui/misc";

function useColors() {
	const { resolvedTheme } = useTheme();
	return getChartColors(resolvedTheme !== "light");
}

type Fmt = (n: number) => string;
const asNum: Fmt = (n) => num(n);

/* ---- container ----------------------------------------------------- */
export function ChartCard({
	title,
	subtitle,
	right,
	children,
	className,
}: {
	title: string;
	subtitle?: string;
	right?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<GlassCard className={cn("flex flex-col p-4", className)}>
			<div className="mb-3 flex items-start justify-between gap-3">
				<div>
					<h3 className="text-[13px] font-semibold tracking-tight text-fg">{title}</h3>
					{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
				</div>
				{right}
			</div>
			<div className="min-h-0 flex-1">{children}</div>
		</GlassCard>
	);
}

/* ---- tooltip ------------------------------------------------------- */
interface TipEntry {
	name?: string | number;
	value?: number | string;
	color?: string;
}
function TooltipBox({
	active,
	payload,
	label,
	fmt = asNum,
	isDate,
}: {
	active?: boolean;
	payload?: TipEntry[];
	label?: string | number;
	fmt?: Fmt;
	isDate?: boolean;
}) {
	const c = useColors();
	if (!active || !payload?.length) return null;
	return (
		<div
			className="rounded-lg px-2.5 py-2 text-xs shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
			style={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.text }}
		>
			{label !== undefined && (
				<div className="mb-1 font-medium text-fg">{isDate ? fmtDate(String(label)) : label}</div>
			)}
			{payload.map((p, i) => (
				<div key={i} className="flex items-center gap-2">
					<span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
					<span className="text-muted">{p.name}</span>
					<span className="tnum ml-auto font-semibold text-fg">{fmt(Number(p.value ?? 0))}</span>
				</div>
			))}
		</div>
	);
}

const gridProps = (c: ReturnType<typeof getChartColors>) => ({
	stroke: c.axis,
	fontSize: 11,
	tickLine: false,
	axisLine: false,
});

/* ---- area / line trend --------------------------------------------- */
export function AreaTrend({
	data,
	labels = ["Value", "Secondary"],
	height = 240,
	currency,
}: {
	data: TrendPoint[];
	labels?: [string, string];
	height?: number;
	currency?: boolean;
}) {
	const c = useColors();
	const mounted = useMounted();
	const dual = data.some((d) => d.value2 !== undefined);
	const fmt: Fmt = currency ? (n) => `$${compact(n)}` : asNum;
	if (!mounted) return <Skeleton style={{ height }} className="w-full" />;

	return (
		<ResponsiveContainer width="100%" height={height}>
			<AreaChart data={data} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
				<defs>
					<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor={c.brand} stopOpacity={0.12} />
						<stop offset="100%" stopColor={c.brand} stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid stroke={c.grid} strokeDasharray="4 4" vertical={false} />
				<XAxis dataKey="date" tickFormatter={(d) => fmtDate(d)} minTickGap={28} {...gridProps(c)} />
				<YAxis tickFormatter={(v) => compact(v)} width={38} {...gridProps(c)} />
				<Tooltip
					cursor={{ stroke: c.axis, strokeDasharray: 4 }}
					content={(p) => (
						<TooltipBox
							active={p.active}
							label={p.label as string}
							payload={p.payload as unknown as TipEntry[]}
							fmt={fmt}
							isDate
						/>
					)}
				/>
				{dual && (
					<Area
						type="monotone"
						dataKey="value2"
						name={labels[1]}
						stroke={c.secondary}
						strokeWidth={1.5}
						strokeDasharray="4 3"
						fill="none"
					/>
				)}
				<Area
					type="monotone"
					dataKey="value"
					name={labels[0]}
					stroke={c.brand}
					strokeWidth={2}
					fill="url(#areaFill)"
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

/* ---- vertical bars (NameValue) ------------------------------------- */
export function Bars({
	data,
	height = 240,
	multicolor,
	currency,
}: {
	data: NameValue[];
	height?: number;
	multicolor?: boolean;
	currency?: boolean;
}) {
	const c = useColors();
	const mounted = useMounted();
	const fmt: Fmt = currency ? (n) => `$${compact(n)}` : asNum;
	if (!mounted) return <Skeleton style={{ height }} className="w-full" />;

	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
				<CartesianGrid stroke={c.grid} strokeDasharray="4 4" vertical={false} />
				<XAxis
					dataKey="name"
					{...gridProps(c)}
					interval={0}
					angle={data.length > 7 ? -20 : 0}
					textAnchor={data.length > 7 ? "end" : "middle"}
					height={data.length > 7 ? 44 : 20}
				/>
				<YAxis tickFormatter={(v) => compact(v)} width={38} {...gridProps(c)} />
				<Tooltip
					cursor={{ fill: c.grid }}
					content={(p) => (
						<TooltipBox active={p.active} label={p.label as string} payload={p.payload as unknown as TipEntry[]} fmt={fmt} />
					)}
				/>
				<Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]} maxBarSize={40}>
					{data.map((_, i) => (
						<Cell key={i} fill={multicolor ? c.categorical[i % c.categorical.length] : c.brand} />
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

/* ---- donut --------------------------------------------------------- */
export function Donut({ data, height = 240 }: { data: NameValue[]; height?: number }) {
	const c = useColors();
	const mounted = useMounted();
	const total = data.reduce((s, d) => s + d.value, 0) || 1;
	// channel identity gets its hue; other categories use the harmonized palette
	const sliceColor = (name: string, i: number) => sourceColor(name, c.categorical[i % c.categorical.length]);
	if (!mounted) return <Skeleton style={{ height }} className="w-full" />;

	return (
		<div className="flex items-center gap-4" style={{ minHeight: height }}>
			<ResponsiveContainer width="55%" height={height}>
				<PieChart>
					<Pie
						data={data}
						dataKey="value"
						nameKey="name"
						innerRadius="58%"
						outerRadius="88%"
						paddingAngle={2}
						stroke="none"
					>
						{data.map((d, i) => (
							<Cell key={i} fill={sliceColor(d.name, i)} />
						))}
					</Pie>
					<Tooltip content={(p) => <TooltipBox active={p.active} payload={p.payload as unknown as TipEntry[]} />} />
				</PieChart>
			</ResponsiveContainer>
			<ul className="flex-1 space-y-1.5 text-[13px]">
				{data.map((d, i) => (
					<li key={d.name} className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: sliceColor(d.name, i) }} />
						<span className="truncate capitalize text-muted">{d.name.replace(/_/g, " ")}</span>
						<span className="tnum ml-auto font-medium text-fg">{Math.round((d.value / total) * 100)}%</span>
					</li>
				))}
			</ul>
		</div>
	);
}

/* ---- horizontal ranking list (pure CSS, always legible) ------------ */
export function BarList({
	data,
	currency,
	className,
}: {
	data: NameValue[];
	currency?: boolean;
	className?: string;
}) {
	const max = Math.max(...data.map((d) => d.value), 1);
	const fmt: Fmt = currency ? (n) => `$${compact(n)}` : asNum;
	return (
		<ul className={cn("space-y-2.5", className)}>
			{data.map((d) => (
				<li key={d.name} className="group">
					<div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
						<span className="truncate capitalize text-fg">{d.name.replace(/_/g, " ")}</span>
						<span className="tnum shrink-0 font-medium text-muted">{fmt(d.value)}</span>
					</div>
					<div className="h-1.5 overflow-hidden rounded-full bg-[var(--accent-soft)]">
						<div
							className="h-full rounded-full bg-accent group-hover:brightness-110"
							style={{ width: `${(d.value / max) * 100}%` }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

/* ---- funnel (pure CSS decreasing bars) ----------------------------- */
export function FunnelBars({ data }: { data: NameValue[] }) {
	const top = data[0]?.value || 1;
	return (
		<div className="space-y-2">
			{data.map((d, i) => {
				const pctOfTop = Math.round((d.value / top) * 100);
				return (
					<div key={d.name} className="flex items-center gap-3">
						<span className="w-20 shrink-0 text-xs text-muted">{d.name}</span>
						<div className="relative h-8 flex-1 overflow-hidden rounded-md bg-[var(--accent-soft)]">
							<div
								className="flex h-full items-center rounded-md bg-accent px-2 text-xs font-semibold text-accent-fg"
								style={{ width: `${Math.max(pctOfTop, 8)}%`, opacity: 1 - i * 0.14 }}
							>
								<span className="tnum">{num(d.value)}</span>
							</div>
						</div>
						<span className="tnum w-10 shrink-0 text-right text-xs text-faint">{pctOfTop}%</span>
					</div>
				);
			})}
		</div>
	);
}
