export function PageHeader({
	title,
	subtitle,
	actions,
}: {
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 className="text-[24px] font-black tracking-tight text-fg">{title}</h1>
				{subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
			</div>
			{actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}
