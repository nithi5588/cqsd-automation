"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, createColumnHelper } from "@/components/ui/data-table";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useApi";
import { ApiError, campaignsApi, segmentsApi, webinarsApi } from "@/lib/api";
import { fmtDateTime, fromNow, num, pct } from "@/lib/format";
import type {
	CampaignCreateInput,
	CampaignListItem,
	Segment,
	WebinarListItem,
} from "@/types/domain";

type TabKey = "ALL" | "DRAFT" | "SCHEDULED" | "SENT";

const TABS: Array<{ value: TabKey; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "DRAFT", label: "Draft" },
	{ value: "SCHEDULED", label: "Scheduled" },
	{ value: "SENT", label: "Sent" },
];

/** The API caps pageSize at 200 — a single request covers the tabs; larger sets show a note. */
const PAGE_SIZE = 200;

const col = createColumnHelper<CampaignListItem>();

const columns = [
	col.accessor("name", {
		header: "Name",
		cell: (c) => <span className="font-medium text-fg">{c.getValue()}</span>,
	}),
	col.accessor("subject", {
		header: "Subject",
		cell: (c) => <span className="block max-w-[220px] truncate text-muted">{c.getValue()}</span>,
	}),
	col.accessor((r) => r.volumeNumber ?? 0, {
		id: "volume",
		header: "Vol",
		cell: (c) =>
			c.row.original.volumeNumber != null ? (
				<span className="tnum">{c.row.original.volumeNumber}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	col.accessor((r) => r.segment?.name ?? "", {
		id: "segment",
		header: "Segment",
		cell: (c) =>
			c.getValue() ? (
				<span className="block max-w-[160px] truncate">{c.getValue()}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	col.accessor((r) => r.webinar?.title ?? "", {
		id: "webinar",
		header: "Webinar",
		cell: (c) =>
			c.getValue() ? (
				<span className="block max-w-[180px] truncate">{c.getValue()}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	col.accessor("status", {
		header: "Status",
		cell: (c) => <StatusPill status={c.getValue()} />,
	}),
	col.accessor((r) => r.scheduledAt ?? "", {
		id: "scheduledAt",
		header: "Scheduled",
		cell: (c) =>
			c.getValue() ? (
				<span className="text-muted">{fmtDateTime(c.getValue())}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	col.accessor((r) => r.stat?.sends ?? 0, {
		id: "sends",
		header: "Sends",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	col.accessor((r) => r.stat?.uniqueOpens ?? 0, {
		id: "uniqueOpens",
		header: "Opens",
		cell: (c) => {
			const stat = c.row.original.stat;
			const sends = stat?.sends ?? 0;
			const opens = stat?.uniqueOpens ?? 0;
			return (
				<span className="tnum">
					{num(opens)}
					{sends > 0 && <span className="ml-1 text-xs text-faint">{pct(opens / sends)}</span>}
				</span>
			);
		},
	}),
	col.accessor((r) => r.stat?.uniqueClicks ?? 0, {
		id: "uniqueClicks",
		header: "Clicks",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	col.accessor((r) => r.stat?.lastSyncedAt ?? "", {
		id: "lastSyncedAt",
		header: "Synced",
		cell: (c) =>
			c.getValue() ? (
				<span className="text-muted">{fromNow(c.getValue())}</span>
			) : (
				<span className="text-faint">Never</span>
			),
	}),
];

interface CampaignForm {
	name: string;
	subject: string;
	fromName: string;
	fromEmail: string;
	replyTo: string;
	segmentId: string;
	webinarId: string;
	volumeNumber: string;
	htmlContent: string;
	scheduledAt: string;
}

const emptyForm: CampaignForm = {
	name: "",
	subject: "",
	fromName: "",
	fromEmail: "",
	replyTo: "",
	segmentId: "",
	webinarId: "",
	volumeNumber: "",
	htmlContent: "",
	scheduledAt: "",
};

function CampaignFormFields({
	form,
	setForm,
	segments,
	webinars,
}: {
	form: CampaignForm;
	setForm: React.Dispatch<React.SetStateAction<CampaignForm>>;
	segments: Segment[];
	webinars: WebinarListItem[];
}) {
	const set = (key: keyof CampaignForm) => (value: string) =>
		setForm((f) => ({ ...f, [key]: value }));
	return (
		<div className="space-y-4">
			<div className="grid gap-3 sm:grid-cols-2">
				<div className="sm:col-span-2">
					<Label htmlFor="cf-name">Name</Label>
					<Input
						id="cf-name"
						value={form.name}
						onChange={(e) => set("name")(e.target.value)}
						placeholder="Webinar volume 1 — Healthcare"
					/>
				</div>
				<div className="sm:col-span-2">
					<Label htmlFor="cf-subject">Subject</Label>
					<Input
						id="cf-subject"
						value={form.subject}
						onChange={(e) => set("subject")(e.target.value)}
						placeholder="You're invited: modernizing customer service"
					/>
				</div>
				<div>
					<Label htmlFor="cf-from-name">From name</Label>
					<Input
						id="cf-from-name"
						value={form.fromName}
						onChange={(e) => set("fromName")(e.target.value)}
						placeholder="CompQsoft Marketing"
					/>
				</div>
				<div>
					<Label htmlFor="cf-from-email">From email</Label>
					<Input
						id="cf-from-email"
						type="email"
						value={form.fromEmail}
						onChange={(e) => set("fromEmail")(e.target.value)}
						placeholder="marketing@compqsoft.com"
					/>
				</div>
				<div>
					<Label htmlFor="cf-reply-to">Reply-to (optional)</Label>
					<Input
						id="cf-reply-to"
						type="email"
						value={form.replyTo}
						onChange={(e) => set("replyTo")(e.target.value)}
						placeholder="sales@compqsoft.com"
					/>
				</div>
				<div>
					<Label htmlFor="cf-volume">Volume number (optional)</Label>
					<Input
						id="cf-volume"
						type="number"
						min={1}
						value={form.volumeNumber}
						onChange={(e) => set("volumeNumber")(e.target.value)}
						placeholder="1"
					/>
				</div>
				<div>
					<Label htmlFor="cf-segment">Segment</Label>
					<Select
						id="cf-segment"
						value={form.segmentId}
						onChange={(e) => set("segmentId")(e.target.value)}
					>
						<option value="">No segment</option>
						{segments.map((s) => (
							<option key={s.id} value={s.id}>
								{s.name} ({num(s.memberCount)})
							</option>
						))}
					</Select>
				</div>
				<div>
					<Label htmlFor="cf-webinar">Webinar (optional)</Label>
					<Select
						id="cf-webinar"
						value={form.webinarId}
						onChange={(e) => set("webinarId")(e.target.value)}
					>
						<option value="">No webinar</option>
						{webinars.map((w) => (
							<option key={w.id} value={w.id}>
								{w.title}
							</option>
						))}
					</Select>
				</div>
				<div className="sm:col-span-2">
					<Label htmlFor="cf-scheduled">Schedule for (optional)</Label>
					<Input
						id="cf-scheduled"
						type="datetime-local"
						value={form.scheduledAt}
						onChange={(e) => set("scheduledAt")(e.target.value)}
					/>
				</div>
				<div className="sm:col-span-2">
					<Label htmlFor="cf-html">HTML content</Label>
					<Textarea
						id="cf-html"
						value={form.htmlContent}
						onChange={(e) => set("htmlContent")(e.target.value)}
						placeholder="<html>…</html>"
						className="min-h-40 font-mono text-xs"
						spellCheck={false}
					/>
				</div>
			</div>
		</div>
	);
}

export default function CampaignsPage() {
	const { token } = useAuth();
	const toast = useToast();
	const router = useRouter();

	const { data, loading, error, reload } = useAsyncData(
		() => campaignsApi.list(token, { page: 1, pageSize: PAGE_SIZE }),
		[token],
	);
	const options = useAsyncData(async () => {
		const [segments, webinars] = await Promise.all([
			segmentsApi.list(token),
			webinarsApi.list(token, { page: 1, pageSize: 200 }),
		]);
		return { segments: segments.items, webinars: webinars.items };
	}, [token]);

	const [tab, setTab] = useState<TabKey>("ALL");
	const [createOpen, setCreateOpen] = useState(false);
	const [form, setForm] = useState<CampaignForm>(emptyForm);
	const [saving, setSaving] = useState(false);

	const campaigns = useMemo(() => data?.items ?? [], [data]);
	const total = data?.total ?? 0;
	const filtered = useMemo(
		() => (tab === "ALL" ? campaigns : campaigns.filter((c) => c.status === tab)),
		[campaigns, tab],
	);
	const tabItems = useMemo(
		() =>
			TABS.map((t) => ({
				...t,
				count: t.value === "ALL" ? campaigns.length : campaigns.filter((c) => c.status === t.value).length,
			})),
		[campaigns],
	);

	const canCreate =
		form.name.trim() !== "" &&
		form.subject.trim() !== "" &&
		form.fromName.trim() !== "" &&
		form.fromEmail.trim() !== "";

	async function handleCreate() {
		setSaving(true);
		try {
			const input: CampaignCreateInput = {
				name: form.name.trim(),
				subject: form.subject.trim(),
				fromName: form.fromName.trim(),
				fromEmail: form.fromEmail.trim(),
				...(form.replyTo.trim() ? { replyTo: form.replyTo.trim() } : {}),
				...(form.segmentId ? { segmentId: form.segmentId } : {}),
				...(form.webinarId ? { webinarId: form.webinarId } : {}),
				...(form.volumeNumber.trim()
					? { volumeNumber: Number.parseInt(form.volumeNumber, 10) }
					: {}),
				...(form.htmlContent.trim() ? { htmlContent: form.htmlContent } : {}),
				...(form.scheduledAt ? { scheduledAt: new Date(form.scheduledAt).toISOString() } : {}),
			};
			const { campaign } = await campaignsApi.create(token, input);
			toast(`Campaign "${campaign.name}" created`);
			setCreateOpen(false);
			setForm(emptyForm);
			reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<PageHeader
				title="Campaigns"
				subtitle="Email campaigns pushed to Constant Contact — sends, opens and clicks per volume."
				actions={
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						<Plus size={16} /> New campaign
					</Button>
				}
			/>

			<div className="space-y-3">
				<Segmented items={tabItems} value={tab} onChange={setTab} />

				{loading ? (
					<div className="space-y-3">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-96 w-full" />
					</div>
				) : error ? (
					<GlassCard>
						<EmptyState title="Couldn't load campaigns" hint={error} />
						<div className="-mt-8 flex justify-center pb-10">
							<Button variant="glass" size="sm" onClick={reload}>
								Retry
							</Button>
						</div>
					</GlassCard>
				) : (
					<>
						<DataTable
							data={filtered}
							columns={columns}
							searchPlaceholder="Search name, subject…"
							pageSize={15}
							onRowClick={(row) => router.push(`/campaigns/${row.id}`)}
							initialSorting={[{ id: "sends", desc: true }]}
						/>
						{total > campaigns.length && (
							<p className="text-xs text-muted">
								Showing the first {num(campaigns.length)} of {num(total)} campaigns.
							</p>
						)}
					</>
				)}
			</div>

			<Modal
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				title="Create campaign"
				subtitle="Draft an email campaign — push it to Constant Contact when it's ready."
				size="lg"
				footer={
					<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleCreate} disabled={saving || !canCreate}>
							{saving ? <Spinner /> : "Create campaign"}
						</Button>
					</>
				}
			>
				<CampaignFormFields
					form={form}
					setForm={setForm}
					segments={options.data?.segments ?? []}
					webinars={options.data?.webinars ?? []}
				/>
			</Modal>
		</>
	);
}
