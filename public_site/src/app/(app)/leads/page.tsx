"use client";

import { ChevronLeft, ChevronRight, RefreshCw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAsyncData } from "@/hooks/useApi";
import { leadsApi } from "@/lib/api";
import { fmtDateTime, num } from "@/lib/format";
import type { LeadImportJob } from "@/types/domain";

const PAGE_SIZE = 25;

const SOURCE_LABEL: Record<string, string> = {
	CSV: "CSV",
	LEADGEN: "LeadGen",
};

export default function LeadsPage() {
	const { token } = useAuth();
	const router = useRouter();

	const [page, setPage] = useState(1);

	const list = useAsyncData(() => leadsApi.imports(token, { page, pageSize: PAGE_SIZE }), [token, page]);

	const items = list.data?.items ?? [];
	const total = list.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const columns = useMemo<ColumnDef<LeadImportJob>[]>(
		() => [
			{
				id: "source",
				header: "Source",
				accessorFn: (r) => r.source,
				cell: ({ row }) => <Badge>{SOURCE_LABEL[row.original.source] ?? row.original.source}</Badge>,
			},
			{
				id: "status",
				header: "Status",
				accessorFn: (r) => r.status,
				cell: ({ row }) => <StatusPill status={row.original.status} />,
			},
			{
				id: "count",
				header: "Contacts",
				accessorFn: (r) => r.count,
				cell: ({ row }) => <span className="tnum font-medium text-fg">{num(row.original.count)}</span>,
			},
			{
				id: "error",
				header: "Error",
				accessorFn: (r) => r.error ?? "",
				cell: ({ row }) =>
					row.original.error ? (
						<span
							className="inline-block max-w-72 truncate align-middle text-[var(--danger)]"
							title={row.original.error}
						>
							{row.original.error}
						</span>
					) : (
						<span className="text-faint">—</span>
					),
			},
			{
				id: "created",
				header: "Imported",
				accessorFn: (r) => r.createdAt,
				cell: ({ row }) => <span className="text-muted">{fmtDateTime(row.original.createdAt)}</span>,
			},
		],
		[],
	);

	return (
		<>
			<PageHeader
				title="Leads"
				subtitle={
					list.data
						? `${num(total)} import run${total === 1 ? "" : "s"} recorded`
						: "Import history for CSV and LeadGen contact loads"
				}
				actions={
					<Button variant="primary" onClick={() => router.push("/contacts")}>
						<Upload size={16} /> Import contacts
					</Button>
				}
			/>

			{list.error ? (
				<GlassCard>
					<EmptyState title="Couldn't load import history" hint={list.error} />
					<div className="flex justify-center pb-8">
						<Button variant="glass" onClick={list.reload}>
							<RefreshCw size={15} /> Retry
						</Button>
					</div>
				</GlassCard>
			) : list.loading && !list.data ? (
				<div className="space-y-3">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-80 w-full" />
				</div>
			) : total === 0 ? (
				<GlassCard>
					<EmptyState
						icon={<Upload size={28} />}
						title="No imports yet"
						hint="Import contacts from a CSV on the Contacts page — every run is recorded here with its status and row count."
					/>
					<div className="flex justify-center pb-8">
						<Button variant="primary" onClick={() => router.push("/contacts")}>
							<Upload size={16} /> Import contacts
						</Button>
					</div>
				</GlassCard>
			) : (
				<>
					<DataTable
						data={items}
						columns={columns}
						searchPlaceholder="Filter this page…"
						pageSize={PAGE_SIZE}
						initialSorting={[{ id: "created", desc: true }]}
						toolbar={
							<span className="text-xs text-muted">
								CSV imports run from the{" "}
								<button
									type="button"
									onClick={() => router.push("/contacts")}
									className="font-medium text-fg underline-offset-2 hover:underline"
								>
									Contacts page
								</button>
								.
							</span>
						}
					/>
					{pageCount > 1 && (
						<div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted">
							<span className="tnum">
								Page {page} of {pageCount} · {num(total)} imports
							</span>
							<div className="flex items-center gap-1.5">
								<Button
									variant="glass"
									size="icon"
									onClick={() => setPage((p) => Math.max(1, p - 1))}
									disabled={page <= 1 || list.loading}
									aria-label="Previous page"
								>
									<ChevronLeft size={16} />
								</Button>
								<Button
									variant="glass"
									size="icon"
									onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
									disabled={page >= pageCount || list.loading}
									aria-label="Next page"
								>
									<ChevronRight size={16} />
								</Button>
							</div>
						</div>
					)}
				</>
			)}
		</>
	);
}
