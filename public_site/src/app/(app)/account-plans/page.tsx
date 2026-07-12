"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useAsyncData } from "@/hooks/useApi";
import { accountPlansApi } from "@/lib/api";
import { fromNow, num, pct } from "@/lib/format";
import type { AccountPlanListItem } from "@/types/domain";

export default function AccountPlansPage() {
	const { token } = useAuth();
	const router = useRouter();

	const { data, loading, error, reload } = useAsyncData(
		() => accountPlansApi.list(token, { pageSize: 200 }),
		[token],
	);

	const columns: ColumnDef<AccountPlanListItem>[] = [
		{
			accessorKey: "name",
			header: "Company",
			cell: ({ row }) => <span className="font-medium text-fg">{row.original.name}</span>,
		},
		{
			accessorKey: "industry",
			header: "Industry",
			cell: ({ row }) => <span className="text-muted">{row.original.industry ?? "—"}</span>,
		},
		{
			accessorKey: "aeOwner",
			header: "AE owner",
			cell: ({ row }) => <span className="text-muted">{row.original.aeOwner ?? "—"}</span>,
		},
		{
			accessorKey: "contacts",
			header: "Contacts",
			cell: ({ row }) => <span className="tnum">{num(row.original.contacts)}</span>,
		},
		{
			accessorKey: "emailsSent",
			header: "Emails sent",
			cell: ({ row }) => <span className="tnum">{num(row.original.emailsSent)}</span>,
		},
		{
			accessorKey: "uniqueOpens",
			header: "Unique opens",
			cell: ({ row }) => <span className="tnum">{num(row.original.uniqueOpens)}</span>,
		},
		{
			accessorKey: "uniqueClicks",
			header: "Unique clicks",
			cell: ({ row }) => <span className="tnum">{num(row.original.uniqueClicks)}</span>,
		},
		{
			accessorKey: "attendees",
			header: "Attendees",
			cell: ({ row }) => <span className="tnum">{num(row.original.attendees)}</span>,
		},
		{
			accessorKey: "openRate",
			header: "Open rate",
			cell: ({ row }) => <span className="tnum">{pct(row.original.openRate)}</span>,
		},
		{
			accessorKey: "clickRate",
			header: "Click rate",
			cell: ({ row }) => <span className="tnum">{pct(row.original.clickRate)}</span>,
		},
		{
			accessorKey: "lastActivityAt",
			header: "Last activity",
			cell: ({ row }) => (
				<span className="text-muted">
					{row.original.lastActivityAt ? fromNow(row.original.lastActivityAt) : "—"}
				</span>
			),
		},
	];

	return (
		<div className="space-y-4">
			<PageHeader
				title="Account Plans"
				subtitle="Per-account engagement rollups — email activity and webinar attendance grouped by company."
			/>

			{loading ? (
				<div className="space-y-3">
					<Skeleton className="h-12" />
					<Skeleton className="h-72" />
				</div>
			) : error ? (
				<GlassCard>
					<EmptyState icon={<Building2 size={28} />} title="Couldn't load account plans" hint={error} />
					<div className="flex justify-center pb-8">
						<Button onClick={reload}>Retry</Button>
					</div>
				</GlassCard>
			) : (
				<DataTable
					data={data?.items ?? []}
					columns={columns}
					searchPlaceholder="Search companies…"
					initialSorting={[{ id: "uniqueClicks", desc: true }]}
					onRowClick={(row) => router.push(`/account-plans/${row.orgId}`)}
				/>
			)}
		</div>
	);
}
