"use client";

import {
	type ColumnDef,
	type SortingState,
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, ChevronUp, Download, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";
import { EmptyState } from "./misc";

export { createColumnHelper };
export type { ColumnDef };

function toCsv<T>(rows: T[], columns: { id: string; header: string }[]): string {
	const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
	const head = columns.map((c) => esc(c.header)).join(",");
	const body = rows
		.map((r) => columns.map((c) => esc((r as Record<string, unknown>)[c.id])).join(","))
		.join("\n");
	return `${head}\n${body}`;
}

export function DataTable<T>({
	data,
	columns,
	toolbar,
	searchPlaceholder = "Search…",
	pageSize = 10,
	onRowClick,
	exportName,
	initialSorting = [],
	className,
}: {
	data: T[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	columns: ColumnDef<T, any>[];
	toolbar?: React.ReactNode;
	searchPlaceholder?: string;
	pageSize?: number;
	onRowClick?: (row: T) => void;
	exportName?: string;
	initialSorting?: SortingState;
	className?: string;
}) {
	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [globalFilter, setGlobalFilter] = useState("");

	const table = useReactTable({
		data,
		columns,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: "includesString",
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageSize } },
	});

	const exportCsv = () => {
		const cols = table
			.getAllLeafColumns()
			.filter((c) => c.id !== "actions")
			.map((c) => ({ id: c.id, header: typeof c.columnDef.header === "string" ? c.columnDef.header : c.id }));
		const rows = table.getFilteredRowModel().rows.map((r) => r.original);
		const blob = new Blob([toCsv(rows, cols)], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${exportName ?? "export"}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const rows = table.getRowModel().rows;
	const pageCount = table.getPageCount();

	return (
		<div
			className={cn(
				"rounded-[10px] border border-hairline bg-[var(--glass-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.05)]",
				className,
			)}
		>
			{/* toolbar */}
			<div className="flex flex-wrap items-center gap-2 p-3">
				<div className="flex flex-1 flex-wrap items-center gap-2 text-[13px]">{toolbar}</div>
				<div className="flex h-8 w-56 max-w-full items-center gap-2 rounded-lg border border-hairline bg-[var(--glass-strong)] px-2.5">
					<Search size={14} className="shrink-0 text-faint" />
					<input
						value={globalFilter}
						onChange={(e) => setGlobalFilter(e.target.value)}
						placeholder={searchPlaceholder}
						className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
					/>
				</div>
				{exportName && (
					<Button variant="glass" size="sm" onClick={exportCsv} title="Export CSV">
						<Download size={14} /> CSV
					</Button>
				)}
			</div>

			{/* table */}
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] border-collapse text-[13px]">
					<thead>
						{table.getHeaderGroups().map((hg) => (
							<tr key={hg.id} className="border-y border-hairline">
								{hg.headers.map((h) => {
									const sortable = h.column.getCanSort();
									const dir = h.column.getIsSorted();
									return (
										<th
											key={h.id}
											className="whitespace-nowrap px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted"
										>
											{h.isPlaceholder ? null : sortable ? (
												<button
													className="inline-flex items-center gap-1 hover:text-fg"
													onClick={h.column.getToggleSortingHandler()}
												>
													{flexRender(h.column.columnDef.header, h.getContext())}
													{dir === "asc" ? (
														<ChevronUp size={12} />
													) : dir === "desc" ? (
														<ChevronDown size={12} />
													) : (
														<ChevronsUpDown size={12} className="opacity-40" />
													)}
												</button>
											) : (
												flexRender(h.column.columnDef.header, h.getContext())
											)}
										</th>
									);
								})}
							</tr>
						))}
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.id}
								onClick={() => onRowClick?.(row.original)}
								className={cn(
									"border-b border-[#eef0f3] transition-colors last:border-0 dark:border-[#232b35]",
									"hover:bg-[#f9fafb] dark:hover:bg-[#1b222b]",
									onRowClick && "cursor-pointer",
								)}
							>
								{row.getVisibleCells().map((cell) => (
									<td key={cell.id} className="h-10 whitespace-nowrap px-4 py-1.5 align-middle">
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{rows.length === 0 && <EmptyState title="No matching records" hint="Try adjusting your filters or search." />}

			{/* pagination */}
			{pageCount > 1 && (
				<div className="flex items-center justify-between gap-2 border-t border-[#eef0f3] px-3 py-2 text-xs text-muted dark:border-[#232b35]">
					<span className="tnum">
						{table.getFilteredRowModel().rows.length} rows · page {table.getState().pagination.pageIndex + 1} of{" "}
						{pageCount}
					</span>
					<div className="flex items-center gap-1.5">
						<Button
							variant="glass"
							size="icon"
							onClick={() => table.previousPage()}
							disabled={!table.getCanPreviousPage()}
							aria-label="Previous page"
						>
							<ChevronLeft size={16} />
						</Button>
						<Button
							variant="glass"
							size="icon"
							onClick={() => table.nextPage()}
							disabled={!table.getCanNextPage()}
							aria-label="Next page"
						>
							<ChevronRight size={16} />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
