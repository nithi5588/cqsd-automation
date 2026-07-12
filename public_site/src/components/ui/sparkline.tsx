/** Dependency-free inline SVG sparkline (monochrome). */
export function Sparkline({
	data,
	width = 96,
	height = 28,
	className,
}: {
	data: number[];
	width?: number;
	height?: number;
	className?: string;
}) {
	if (!data.length) return null;
	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;
	const step = width / (data.length - 1 || 1);
	const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 4) - 2]);
	const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
	const area = `${d} L${width},${height} L0,${height} Z`;
	return (
		<svg width={width} height={height} className={className} preserveAspectRatio="none" aria-hidden>
			<path d={area} fill="currentColor" opacity={0.12} />
			<path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}
