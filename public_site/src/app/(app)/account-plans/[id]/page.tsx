"use client";

import { Building2, Download } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ChartCard, Donut } from "@/components/charts";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Dot, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { GlassCard, SectionTitle } from "@/components/ui/glass";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { useAsyncData } from "@/hooks/useApi";
import { accountPlansApi, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { compact, dur, fmtDate, fromNow, num, titleCase } from "@/lib/format";
import type { AccountPlanContactRow } from "@/types/domain";
import type { Kpi } from "@/types/ui";

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong");

interface MiniColumn<T> {
	key: string;
	label: string;
	align?: "right";
	render: (row: T) => React.ReactNode;
}

/** Compact table for short supporting lists (campaigns, webinars). */
function MiniTable<T>({
	columns,
	rows,
	rowKey,
	empty,
	onRowClick,
}: {
	columns: MiniColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	empty: string;
	onRowClick?: (row: T) => void;
}) {
	if (rows.length === 0) {
		return <p className="px-3 py-8 text-center text-sm text-muted">{empty}</p>;
	}
	return (
		<div className="mt-3 overflow-x-auto">
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b border-hairline">
						{columns.map((c) => (
							<th
								key={c.key}
								className={cn(
									"whitespace-nowrap px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted",
									c.align === "right" && "text-right",
								)}
							>
								{c.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={rowKey(row)}
							onClick={() => onRowClick?.(row)}
							className={cn(
								"border-b border-hairline/60 transition-colors last:border-0",
								onRowClick && "cursor-pointer hover:bg-[var(--accent-soft)]",
							)}
						>
							{columns.map((c) => (
								<td
									key={c.key}
									className={cn(
										"whitespace-nowrap px-3 py-2 align-middle",
										c.align === "right" && "text-right",
									)}
								>
									{c.render(row)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default function AccountPlanDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { token } = useAuth();
	const toast = useToast();
	const router = useRouter();

	const { data: plan, loading, error, reload } = useAsyncData(
		() => accountPlansApi.get(token, id),
		[token, id],
	);

	const [exporting, setExporting] = useState(false);

	async function handleExport() {
		setExporting(true);
		try {
			await accountPlansApi.downloadExport(token, id);
			toast("Account plan CSV downloaded");
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setExporting(false);
		}
	}

	if (loading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-16 w-2/3" />
				<KpiGrid loading count={6} />
				<div className="grid gap-3 lg:grid-cols-3">
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
				</div>
				<Skeleton className="h-72" />
			</div>
		);
	}

	if (error || !plan) {
		return (
			<GlassCard>
				<EmptyState
					icon={<Building2 size={28} />}
					title="Couldn't load account plan"
					hint={error ?? "Account plan not found"}
				/>
				<div className="flex justify-center pb-8">
					<Button onClick={reload}>Retry</Button>
				</div>
			</GlassCard>
		);
	}

	const org = plan.organization;
	const totals = plan.totals;

	const subtitle = [
		org.industry ?? "No industry",
		org.aeOwner ? `AE: ${org.aeOwner}` : null,
		org.revenue != null ? `$${compact(org.revenue)} revenue` : null,
	]
		.filter(Boolean)
		.join(" · ");

	const kpis: Kpi[] = [
		{ key: "contacts", label: "Contacts", value: totals.contacts },
		{ key: "emailsSent", label: "Emails sent", value: totals.emailsSent },
		{ key: "uniqueOpens", label: "Unique opens", value: totals.uniqueOpens },
		{ key: "uniqueClicks", label: "Unique clicks", value: totals.uniqueClicks },
		{ key: "webinarsAttended", label: "Webinar attendees", value: totals.webinarsAttended },
		{
			key: "attendedSeconds",
			label: "Time attended",
			value: Math.round(totals.attendedSeconds / 60),
			unit: "min",
			hint: dur(totals.attendedSeconds),
		},
	];

	const personaData = plan.personas.map((p) => ({ name: titleCase(p.persona), value: p.contacts }));

	const contactColumns: ColumnDef<AccountPlanContactRow>[] = [
		{
			accessorKey: "name",
			header: "Contact",
			cell: ({ row }) => (
				<div>
					<div className="font-medium text-fg">{row.original.name}</div>
					<div className="text-xs text-muted">{row.original.email}</div>
				</div>
			),
		},
		{ accessorKey: "title", header: "Title", cell: ({ row }) => row.original.title ?? "—" },
		{
			accessorKey: "persona",
			header: "Persona",
			cell: ({ row }) => (row.original.persona ? titleCase(row.original.persona) : "—"),
		},
		{
			accessorKey: "sent",
			header: "Sent",
			cell: ({ row }) => <span className="tnum">{num(row.original.sent)}</span>,
		},
		{
			accessorKey: "opened",
			header: "Opened",
			cell: ({ row }) => <Dot tone={row.original.opened ? "ok" : "neutral"} />,
		},
		{
			accessorKey: "clicked",
			header: "Clicked",
			cell: ({ row }) => <Dot tone={row.original.clicked ? "ok" : "neutral"} />,
		},
		{
			accessorKey: "openCount",
			header: "Opens",
			cell: ({ row }) => <span className="tnum">{num(row.original.openCount)}</span>,
		},
		{
			accessorKey: "clickCount",
			header: "Clicks",
			cell: ({ row }) => <span className="tnum">{num(row.original.clickCount)}</span>,
		},
		{
			accessorKey: "webinarsAttended",
			header: "Webinars",
			cell: ({ row }) => <span className="tnum">{num(row.original.webinarsAttended)}</span>,
		},
		{
			accessorKey: "totalAttendedSeconds",
			header: "Time attended",
			cell: ({ row }) => <span className="tnum">{dur(row.original.totalAttendedSeconds)}</span>,
		},
		{
			accessorKey: "lastEngagedAt",
			header: "Last engaged",
			cell: ({ row }) => (
				<span className="text-muted">
					{row.original.lastEngagedAt ? fromNow(row.original.lastEngagedAt) : "—"}
				</span>
			),
		},
	];

	return (
		<div className="space-y-4">
			<PageHeader
				title={org.name}
				subtitle={subtitle}
				actions={
					<Button variant="primary" onClick={handleExport} disabled={exporting}>
						{exporting ? <Spinner /> : <Download size={16} />} Export CSV
					</Button>
				}
			/>

			<KpiGrid kpis={kpis} count={6} />

			<div className="grid gap-3 lg:grid-cols-3">
				<ChartCard title="Personas" subtitle="Contacts by persona">
					{personaData.length > 0 ? (
						<Donut data={personaData} height={200} />
					) : (
						<EmptyState title="No persona data" hint="No contacts recorded for this account yet." />
					)}
				</ChartCard>

				<GlassCard className="p-4">
					<SectionTitle title="Campaigns" subtitle="Emails this account received or engaged with" />
					<MiniTable
						rows={plan.campaigns}
						rowKey={(c) => c.campaignId}
						empty="No campaign activity for this account yet."
						onRowClick={(c) => router.push(`/campaigns/${c.campaignId}`)}
						columns={[
							{
								key: "name",
								label: "Campaign",
								render: (c) => (
									<div className="max-w-52">
										<div className="truncate font-medium text-fg">{c.name}</div>
										<div className="truncate text-xs text-muted">{c.subject}</div>
									</div>
								),
							},
							{ key: "status", label: "Status", render: (c) => <StatusPill status={c.status} /> },
							{
								key: "sends",
								label: "Sends",
								align: "right",
								render: (c) => <span className="tnum">{num(c.sends)}</span>,
							},
							{
								key: "uniqueOpens",
								label: "Opens",
								align: "right",
								render: (c) => <span className="tnum">{num(c.uniqueOpens)}</span>,
							},
							{
								key: "uniqueClicks",
								label: "Clicks",
								align: "right",
								render: (c) => <span className="tnum">{num(c.uniqueClicks)}</span>,
							},
						]}
					/>
				</GlassCard>

				<GlassCard className="p-4">
					<SectionTitle title="Webinars" subtitle="Registrations and attendance from this account" />
					<MiniTable
						rows={plan.webinars}
						rowKey={(w) => w.webinarId}
						empty="No webinar activity for this account yet."
						onRowClick={(w) => router.push(`/webinars/${w.webinarId}`)}
						columns={[
							{
								key: "title",
								label: "Webinar",
								render: (w) => (
									<div className="max-w-52">
										<div className="truncate font-medium text-fg">{w.title}</div>
										<div className="tnum text-xs text-muted">{fmtDate(w.startsAt)}</div>
									</div>
								),
							},
							{
								key: "registered",
								label: "Registered",
								align: "right",
								render: (w) => <span className="tnum">{num(w.registered)}</span>,
							},
							{
								key: "attended",
								label: "Attended",
								align: "right",
								render: (w) => <span className="tnum">{num(w.attended)}</span>,
							},
						]}
					/>
				</GlassCard>
			</div>

			<DataTable
				data={plan.contacts}
				columns={contactColumns}
				searchPlaceholder="Search contacts…"
				initialSorting={[{ id: "clickCount", desc: true }]}
				exportName={`account-plan-${org.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-contacts`}
			/>
		</div>
	);
}
