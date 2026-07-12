"use client";

import { Copy, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { FilterSelect } from "@/components/ui/filters";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { useAsyncData } from "@/hooks/useApi";
import { ApiError, webinarsApi } from "@/lib/api";
import { fmtDateTime, num } from "@/lib/format";
import type { WebinarListItem, WebinarStatus } from "@/types/domain";

const TIME_ZONES = [
	"America/Chicago",
	"America/New_York",
	"America/Denver",
	"America/Los_Angeles",
	"America/Phoenix",
	"UTC",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Asia/Kolkata",
	"Asia/Singapore",
	"Asia/Tokyo",
	"Australia/Sydney",
];

const WEBINAR_STATUSES: WebinarStatus[] = ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELED"];

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong");

/** Small icon button that copies a value to the clipboard without triggering the row click. */
function CopyButton({ value, label }: { value: string; label: string }) {
	const toast = useToast();
	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7"
			title={`Copy ${label}`}
			aria-label={`Copy ${label}`}
			onClick={(e) => {
				e.stopPropagation();
				navigator.clipboard
					.writeText(value)
					.then(() => toast(`${label} copied to clipboard`))
					.catch(() => toast("Copy failed", "warn"));
			}}
		>
			<Copy size={14} />
		</Button>
	);
}

interface WebinarForm {
	title: string;
	description: string;
	startsAt: string;
	endsAt: string;
	timeZone: string;
}

const EMPTY_FORM: WebinarForm = {
	title: "",
	description: "",
	startsAt: "",
	endsAt: "",
	timeZone: "America/Chicago",
};

export default function WebinarsPage() {
	const { token } = useAuth();
	const toast = useToast();
	const router = useRouter();

	const [status, setStatus] = useState("");
	const { data, loading, error, reload } = useAsyncData(
		() =>
			webinarsApi.list(token, {
				status: (status || undefined) as WebinarStatus | undefined,
				pageSize: 200,
			}),
		[token, status],
	);

	const [createOpen, setCreateOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [form, setForm] = useState<WebinarForm>(EMPTY_FORM);
	const set = (patch: Partial<WebinarForm>) => setForm((f) => ({ ...f, ...patch }));

	async function handleCreate() {
		if (!form.title.trim()) {
			toast("Title is required", "warn");
			return;
		}
		if (!form.startsAt || !form.endsAt) {
			toast("Start and end times are required", "warn");
			return;
		}
		const start = new Date(form.startsAt);
		const end = new Date(form.endsAt);
		if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
			toast("Invalid date/time", "warn");
			return;
		}
		if (end.getTime() <= start.getTime()) {
			toast("End time must be after the start time", "warn");
			return;
		}
		setSaving(true);
		try {
			const { webinar } = await webinarsApi.create(token, {
				title: form.title.trim(),
				description: form.description.trim() || undefined,
				startsAt: start.toISOString(),
				endsAt: end.toISOString(),
				timeZone: form.timeZone,
			});
			toast("Webinar created as draft");
			setCreateOpen(false);
			setForm(EMPTY_FORM);
			reload();
			router.push(`/webinars/${webinar.id}`);
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setSaving(false);
		}
	}

	const columns: ColumnDef<WebinarListItem>[] = [
		{
			accessorKey: "title",
			header: "Title",
			cell: ({ row }) => (
				<div>
					<div className="font-medium text-fg">{row.original.title}</div>
					<div className="text-xs text-muted">{row.original.slug}</div>
				</div>
			),
		},
		{
			accessorKey: "startsAt",
			header: "Starts",
			cell: ({ row }) => <span className="tnum">{fmtDateTime(row.original.startsAt)}</span>,
		},
		{
			accessorKey: "timeZone",
			header: "Time zone",
			cell: ({ row }) => <span className="text-muted">{row.original.timeZone}</span>,
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => <StatusPill status={row.original.status} />,
		},
		{
			accessorKey: "registrationCount",
			header: "Registrations",
			cell: ({ row }) => <span className="tnum">{num(row.original.registrationCount)}</span>,
		},
		{
			accessorKey: "attendanceCount",
			header: "Attendance",
			cell: ({ row }) => <span className="tnum">{num(row.original.attendanceCount)}</span>,
		},
		{
			id: "joinUrl",
			header: "Join URL",
			enableSorting: false,
			cell: ({ row }) =>
				row.original.joinUrl ? (
					<CopyButton value={row.original.joinUrl} label="Join URL" />
				) : (
					<span className="text-faint">—</span>
				),
		},
	];

	return (
		<div className="space-y-4">
			<PageHeader
				title="Webinars"
				subtitle="Teams webinars — draft locally, publish via Microsoft Graph, then track registrations and attendance."
				actions={
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						<Plus size={16} /> New webinar
					</Button>
				}
			/>

			{loading ? (
				<div className="space-y-3">
					<Skeleton className="h-12" />
					<Skeleton className="h-72" />
				</div>
			) : error ? (
				<GlassCard>
					<EmptyState icon={<Video size={28} />} title="Couldn't load webinars" hint={error} />
					<div className="flex justify-center pb-8">
						<Button onClick={reload}>Retry</Button>
					</div>
				</GlassCard>
			) : (
				<DataTable
					data={data?.items ?? []}
					columns={columns}
					searchPlaceholder="Search webinars…"
					initialSorting={[{ id: "startsAt", desc: true }]}
					onRowClick={(row) => router.push(`/webinars/${row.id}`)}
					toolbar={
						<FilterSelect
							label="Status"
							value={status}
							onChange={setStatus}
							options={WEBINAR_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() }))}
						/>
					}
				/>
			)}

			<Modal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				title="New webinar"
				subtitle="Created as a draft — publish to Teams when the details are final."
				footer={
					<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleCreate} disabled={saving}>
							{saving ? <Spinner /> : <Plus size={16} />} Create webinar
						</Button>
					</>
				}
			>
				<div className="space-y-4">
					<div>
						<Label htmlFor="wb-title">Title</Label>
						<Input
							id="wb-title"
							placeholder="Modernizing Customer Service with AI"
							value={form.title}
							onChange={(e) => set({ title: e.target.value })}
						/>
					</div>
					<div>
						<Label htmlFor="wb-desc">Description</Label>
						<Textarea
							id="wb-desc"
							placeholder="What attendees will learn…"
							value={form.description}
							onChange={(e) => set({ description: e.target.value })}
						/>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<Label htmlFor="wb-start">Starts</Label>
							<Input
								id="wb-start"
								type="datetime-local"
								value={form.startsAt}
								onChange={(e) => set({ startsAt: e.target.value })}
							/>
						</div>
						<div>
							<Label htmlFor="wb-end">Ends</Label>
							<Input
								id="wb-end"
								type="datetime-local"
								value={form.endsAt}
								onChange={(e) => set({ endsAt: e.target.value })}
							/>
						</div>
					</div>
					<div>
						<Label htmlFor="wb-tz">Time zone</Label>
						<Select id="wb-tz" value={form.timeZone} onChange={(e) => set({ timeZone: e.target.value })}>
							{TIME_ZONES.map((tz) => (
								<option key={tz} value={tz}>
									{tz}
								</option>
							))}
						</Select>
					</div>
				</div>
			</Modal>
		</div>
	);
}
