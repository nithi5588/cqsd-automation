"use client";
import {
	ArrowLeft,
	CalendarClock,
	ChevronLeft,
	ChevronRight,
	Download,
	Mail,
	Pencil,
	RefreshCw,
	Search,
	Send,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bars, ChartCard } from "@/components/charts";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, Dot, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, createColumnHelper } from "@/components/ui/data-table";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { FilterSelect } from "@/components/ui/filters";
import { GlassCard } from "@/components/ui/glass";
import { KpiTile } from "@/components/ui/kpi";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useApi";
import { ApiError, campaignsApi, segmentsApi, webinarsApi } from "@/lib/api";
import { fmtDate, fmtDateTime, fromNow, num, pct, titleCase } from "@/lib/format";
import type {
	CampaignActivityFilter,
	CampaignActivityRow,
	CampaignUpdateInput,
	CompanyActivityRow,
	Segment,
	WebinarListItem,
} from "@/types/domain";

/** Server-side page size for the by-contact table. */
const CONTACT_PAGE_SIZE = 50;
/** CSV export fetches in the API's max page size, capped so a runaway dataset can't hang the tab. */
const EXPORT_PAGE_SIZE = 200;
const MAX_EXPORT_PAGES = 25;

/** Flattened per-contact row — column ids map 1:1 to properties so CSV export and search stay accurate. */
interface ContactRow {
	contactId: string;
	name: string;
	title: string;
	email: string;
	company: string;
	persona: string;
	opened: boolean;
	clicked: boolean;
	openCount: number;
	clickCount: number;
	firstOpenAt: string;
	firstClickAt: string;
}

function toContactRow(r: CampaignActivityRow): ContactRow {
	return {
		contactId: r.contactId,
		name: `${r.firstName} ${r.lastName}`.trim(),
		title: r.title ?? "",
		email: r.email,
		company: r.organization?.name ?? "",
		persona: r.persona ?? "",
		opened: r.opened,
		clicked: r.clicked,
		openCount: r.openCount,
		clickCount: r.clickCount,
		firstOpenAt: r.firstOpenAt ?? "",
		firstClickAt: r.firstClickAt ?? "",
	};
}

const EXPORT_COLUMNS: Array<{ id: keyof ContactRow; header: string }> = [
	{ id: "name", header: "Name" },
	{ id: "title", header: "Title" },
	{ id: "email", header: "Email" },
	{ id: "company", header: "Company" },
	{ id: "persona", header: "Persona" },
	{ id: "opened", header: "Opened" },
	{ id: "clicked", header: "Clicked" },
	{ id: "openCount", header: "Opens" },
	{ id: "clickCount", header: "Clicks" },
	{ id: "firstOpenAt", header: "First open" },
	{ id: "firstClickAt", header: "First click" },
];

function toCsv(rows: ContactRow[]): string {
	const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
	const head = EXPORT_COLUMNS.map((c) => esc(c.header)).join(",");
	const body = rows.map((r) => EXPORT_COLUMNS.map((c) => esc(r[c.id])).join(",")).join("\n");
	return `${head}\n${body}`;
}

function downloadCsv(filename: string, csv: string) {
	const blob = new Blob([csv], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

const contactCol = createColumnHelper<ContactRow>();

const contactColumns = [
	contactCol.accessor("name", {
		header: "Name",
		cell: (c) => (
			<div className="min-w-0">
				<p className="truncate font-medium text-fg">{c.getValue()}</p>
				{c.row.original.title && <p className="truncate text-xs text-faint">{c.row.original.title}</p>}
			</div>
		),
	}),
	contactCol.accessor("email", {
		header: "Email",
		cell: (c) => <span className="text-muted">{c.getValue()}</span>,
	}),
	contactCol.accessor("company", {
		header: "Company",
		cell: (c) =>
			c.getValue() ? (
				<span className="block max-w-[180px] truncate">{c.getValue()}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	contactCol.accessor("persona", {
		header: "Persona",
		cell: (c) => (c.getValue() ? <Badge>{titleCase(c.getValue())}</Badge> : <span className="text-faint">—</span>),
	}),
	contactCol.accessor("opened", {
		header: "Opened",
		cell: (c) => <Dot tone={c.getValue() ? "ok" : "neutral"} />,
	}),
	contactCol.accessor("clicked", {
		header: "Clicked",
		cell: (c) => <Dot tone={c.getValue() ? "info" : "neutral"} />,
	}),
	contactCol.accessor("openCount", {
		header: "Opens",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	contactCol.accessor("clickCount", {
		header: "Clicks",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	contactCol.accessor("firstOpenAt", {
		header: "First open",
		cell: (c) =>
			c.getValue() ? (
				<span className="text-muted">{fmtDateTime(c.getValue())}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
	contactCol.accessor("firstClickAt", {
		header: "First click",
		cell: (c) =>
			c.getValue() ? (
				<span className="text-muted">{fmtDateTime(c.getValue())}</span>
			) : (
				<span className="text-faint">—</span>
			),
	}),
];

const companyCol = createColumnHelper<CompanyActivityRow>();

const companyColumns = [
	companyCol.accessor("orgName", {
		header: "Company",
		cell: (c) => <span className="font-medium text-fg">{c.getValue()}</span>,
	}),
	companyCol.accessor("contacts", {
		header: "Contacts",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	companyCol.accessor("opened", {
		header: "Opened",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	companyCol.accessor("clicked", {
		header: "Clicked",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	companyCol.accessor("openCount", {
		header: "Total opens",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
	companyCol.accessor("clickCount", {
		header: "Total clicks",
		cell: (c) => <span className="tnum">{num(c.getValue())}</span>,
	}),
];

interface EditForm {
	name: string;
	subject: string;
	fromName: string;
	fromEmail: string;
	replyTo: string;
	segmentId: string;
	webinarId: string;
	volumeNumber: string;
	htmlContent: string;
}

const emptyEditForm: EditForm = {
	name: "",
	subject: "",
	fromName: "",
	fromEmail: "",
	replyTo: "",
	segmentId: "",
	webinarId: "",
	volumeNumber: "",
	htmlContent: "",
};

/** ISO timestamp → value for `<input type="datetime-local">` in the viewer's timezone. */
function toLocalInput(iso: string | null): string {
	if (!iso) return "";
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function MetaField({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="rounded-xl glass-inset p-3">
			<p className="text-xs text-faint">{label}</p>
			<p className="mt-0.5 truncate text-sm font-medium text-fg">{value}</p>
		</div>
	);
}

function ErrorState({
	title,
	message,
	onRetry,
}: {
	title: string;
	message: string;
	onRetry: () => void;
}) {
	return (
		<GlassCard>
			<EmptyState title={title} hint={message} />
			<div className="-mt-8 flex justify-center pb-10">
				<Button variant="glass" size="sm" onClick={onRetry}>
					Retry
				</Button>
			</div>
		</GlassCard>
	);
}

function EditFormFields({
	form,
	setForm,
	segments,
	webinars,
}: {
	form: EditForm;
	setForm: React.Dispatch<React.SetStateAction<EditForm>>;
	segments: Segment[];
	webinars: WebinarListItem[];
}) {
	const set = (key: keyof EditForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<div className="sm:col-span-2">
				<Label htmlFor="ef-name">Name</Label>
				<Input id="ef-name" value={form.name} onChange={(e) => set("name")(e.target.value)} />
			</div>
			<div className="sm:col-span-2">
				<Label htmlFor="ef-subject">Subject</Label>
				<Input id="ef-subject" value={form.subject} onChange={(e) => set("subject")(e.target.value)} />
			</div>
			<div>
				<Label htmlFor="ef-from-name">From name</Label>
				<Input id="ef-from-name" value={form.fromName} onChange={(e) => set("fromName")(e.target.value)} />
			</div>
			<div>
				<Label htmlFor="ef-from-email">From email</Label>
				<Input
					id="ef-from-email"
					type="email"
					value={form.fromEmail}
					onChange={(e) => set("fromEmail")(e.target.value)}
				/>
			</div>
			<div>
				<Label htmlFor="ef-reply-to">Reply-to</Label>
				<Input
					id="ef-reply-to"
					type="email"
					value={form.replyTo}
					onChange={(e) => set("replyTo")(e.target.value)}
				/>
			</div>
			<div>
				<Label htmlFor="ef-volume">Volume number</Label>
				<Input
					id="ef-volume"
					type="number"
					min={1}
					value={form.volumeNumber}
					onChange={(e) => set("volumeNumber")(e.target.value)}
				/>
			</div>
			<div>
				<Label htmlFor="ef-segment">Segment</Label>
				<Select id="ef-segment" value={form.segmentId} onChange={(e) => set("segmentId")(e.target.value)}>
					<option value="">No segment</option>
					{segments.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name} ({num(s.memberCount)})
						</option>
					))}
				</Select>
			</div>
			<div>
				<Label htmlFor="ef-webinar">Webinar</Label>
				<Select id="ef-webinar" value={form.webinarId} onChange={(e) => set("webinarId")(e.target.value)}>
					<option value="">No webinar</option>
					{webinars.map((w) => (
						<option key={w.id} value={w.id}>
							{w.title}
						</option>
					))}
				</Select>
			</div>
			<div className="sm:col-span-2">
				<Label htmlFor="ef-html">HTML content</Label>
				<Textarea
					id="ef-html"
					value={form.htmlContent}
					onChange={(e) => set("htmlContent")(e.target.value)}
					placeholder="<html>…</html>"
					className="min-h-40 font-mono text-xs"
					spellCheck={false}
				/>
			</div>
		</div>
	);
}

export default function CampaignDetailPage() {
	const params = useParams<{ id: string }>();
	const campaignId = params.id;
	const { token } = useAuth();
	const toast = useToast();

	const { data, loading, error, reload } = useAsyncData(
		() => campaignsApi.get(token, campaignId),
		[token, campaignId],
	);
	const campaign = data?.campaign;

	const [tab, setTab] = useState<"contact" | "company">("contact");
	const [engagement, setEngagementState] = useState("");
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [exporting, setExporting] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => {
			setSearch(searchInput.trim());
			setPage(1);
		}, 300);
		return () => clearTimeout(t);
	}, [searchInput]);

	const setEngagement = (v: string) => {
		setEngagementState(v);
		setPage(1);
	};

	const activityFilter = (engagement === "" ? "all" : engagement) as CampaignActivityFilter;

	const activity = useAsyncData(
		() =>
			campaignsApi.activity(token, campaignId, {
				filter: activityFilter,
				search: search || undefined,
				page,
				pageSize: CONTACT_PAGE_SIZE,
			}),
		[token, campaignId, engagement, search, page],
	);
	const company = useAsyncData(
		() => campaignsApi.activityByCompany(token, campaignId),
		[token, campaignId],
	);

	const options = useAsyncData(async () => {
		const [segments, webinars] = await Promise.all([
			segmentsApi.list(token),
			webinarsApi.list(token, { page: 1, pageSize: 200 }),
		]);
		return { segments: segments.items, webinars: webinars.items };
	}, [token]);

	const [busy, setBusy] = useState<string | null>(null);
	const [editOpen, setEditOpen] = useState(false);
	const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);
	const [testOpen, setTestOpen] = useState(false);
	const [testEmails, setTestEmails] = useState("");
	const [scheduleOpen, setScheduleOpen] = useState(false);
	const [scheduleAt, setScheduleAt] = useState("");

	const contactRows = useMemo<ContactRow[]>(
		() => (activity.data?.items ?? []).map(toContactRow),
		[activity.data],
	);
	const contactTotal = activity.data?.total ?? 0;
	const contactPageCount = Math.max(1, Math.ceil(contactTotal / CONTACT_PAGE_SIZE));
	const companyRows = useMemo(() => company.data?.items ?? [], [company.data]);
	const topByClicks = useMemo(
		() =>
			companyRows
				.filter((r) => r.clickCount > 0)
				.sort((a, b) => b.clickCount - a.clickCount)
				.slice(0, 8)
				.map((r) => ({ name: r.orgName, value: r.clickCount })),
		[companyRows],
	);

	async function run(key: string, fn: () => Promise<void>) {
		setBusy(key);
		try {
			await fn();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setBusy(null);
		}
	}

	function openEdit() {
		if (!campaign) return;
		setEditForm({
			name: campaign.name,
			subject: campaign.subject,
			fromName: campaign.fromName ?? "",
			fromEmail: campaign.fromEmail ?? "",
			replyTo: campaign.replyTo ?? "",
			segmentId: campaign.segment?.id ?? "",
			webinarId: campaign.webinar?.id ?? "",
			volumeNumber: campaign.volumeNumber != null ? String(campaign.volumeNumber) : "",
			htmlContent: campaign.htmlContent ?? "",
		});
		setEditOpen(true);
	}

	function openSchedule() {
		setScheduleAt(toLocalInput(campaign?.scheduledAt ?? null));
		setScheduleOpen(true);
	}

	const handleSaveEdit = () =>
		run("save", async () => {
			const input: CampaignUpdateInput = {
				name: editForm.name.trim(),
				subject: editForm.subject.trim(),
				...(editForm.fromName.trim() ? { fromName: editForm.fromName.trim() } : {}),
				...(editForm.fromEmail.trim() ? { fromEmail: editForm.fromEmail.trim() } : {}),
				...(editForm.replyTo.trim() ? { replyTo: editForm.replyTo.trim() } : {}),
				...(editForm.segmentId ? { segmentId: editForm.segmentId } : {}),
				...(editForm.webinarId ? { webinarId: editForm.webinarId } : {}),
				...(editForm.volumeNumber.trim()
					? { volumeNumber: Number.parseInt(editForm.volumeNumber, 10) }
					: {}),
				...(editForm.htmlContent.trim() ? { htmlContent: editForm.htmlContent } : {}),
			};
			await campaignsApi.update(token, campaignId, input);
			toast("Campaign updated");
			setEditOpen(false);
			reload();
		});

	const handlePush = () =>
		run("push", async () => {
			await campaignsApi.pushToCc(token, campaignId);
			toast("Pushed to Constant Contact");
			reload();
		});

	const handleSendTest = () =>
		run("test", async () => {
			const emails = testEmails
				.split(",")
				.map((e) => e.trim())
				.filter(Boolean);
			await campaignsApi.sendTest(token, campaignId, emails);
			toast(`Test email sent to ${emails.length} recipient${emails.length === 1 ? "" : "s"}`);
			setTestOpen(false);
		});

	const handleSchedule = () =>
		run("schedule", async () => {
			const when = new Date(scheduleAt);
			if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
				toast("Pick a date and time in the future", "warn");
				return;
			}
			await campaignsApi.schedule(token, campaignId, when.toISOString());
			toast("Campaign scheduled");
			setScheduleOpen(false);
			reload();
		});

	const handleUnschedule = () =>
		run("unschedule", async () => {
			await campaignsApi.unschedule(token, campaignId);
			toast("Campaign unscheduled — back to draft");
			reload();
		});

	const handleSync = () =>
		run("sync", async () => {
			await campaignsApi.syncStats(token, campaignId);
			toast("Stats synced from Constant Contact");
			reload();
			activity.reload();
			company.reload();
		});

	/** Full-set CSV export — fetched on demand (click), never on page load. */
	async function handleExportCsv() {
		setExporting(true);
		try {
			const first = await campaignsApi.activity(token, campaignId, {
				filter: activityFilter,
				search: search || undefined,
				page: 1,
				pageSize: EXPORT_PAGE_SIZE,
			});
			const items = [...first.items];
			const totalPages = Math.min(Math.ceil(first.total / first.pageSize), MAX_EXPORT_PAGES);
			for (let p = 2; p <= totalPages; p++) {
				const next = await campaignsApi.activity(token, campaignId, {
					filter: activityFilter,
					search: search || undefined,
					page: p,
					pageSize: EXPORT_PAGE_SIZE,
				});
				items.push(...next.items);
			}
			downloadCsv(`campaign-contacts-${campaignId}.csv`, toCsv(items.map(toContactRow)));
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setExporting(false);
		}
	}

	if (loading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-20 w-full" />
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-[104px]" />
					))}
				</div>
				<Skeleton className="h-96 w-full" />
			</div>
		);
	}

	if (error || !campaign) {
		return (
			<ErrorState
				title="Couldn't load campaign"
				message={error ?? "Campaign not found."}
				onRetry={reload}
			/>
		);
	}

	const stat = campaign.stat;
	const sends = stat?.sends ?? 0;
	const uniqueOpens = stat?.uniqueOpens ?? 0;
	const uniqueClicks = stat?.uniqueClicks ?? 0;
	const openRate = sends > 0 ? uniqueOpens / sends : 0;
	const ctr = sends > 0 ? uniqueClicks / sends : 0;

	const isDraft = campaign.status === "DRAFT";
	const isScheduled = campaign.status === "SCHEDULED";
	const pushed = campaign.ccActivityId != null;

	const testList = testEmails
		.split(",")
		.map((e) => e.trim())
		.filter(Boolean);
	const testValid = testList.length >= 1 && testList.length <= 5 && testList.every((e) => e.includes("@"));

	return (
		<>
			<Link
				href="/campaigns"
				className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
			>
				<ArrowLeft size={15} /> Campaigns
			</Link>

			<PageHeader
				title={campaign.name}
				subtitle={`${campaign.subject}${campaign.volumeNumber != null ? ` · Volume ${campaign.volumeNumber}` : ""}`}
				actions={
					<>
						<StatusPill status={campaign.status} />
						{isDraft && (
							<Button variant="glass" size="sm" onClick={openEdit} disabled={busy !== null}>
								<Pencil size={14} /> Edit
							</Button>
						)}
						{isDraft && !pushed && (
							<Button variant="primary" size="sm" onClick={handlePush} disabled={busy !== null}>
								{busy === "push" ? <Spinner /> : <Send size={14} />} Push to Constant Contact
							</Button>
						)}
						{(isDraft || isScheduled) && (
							<Button
								variant="glass"
								size="sm"
								onClick={() => {
									setTestEmails("");
									setTestOpen(true);
								}}
								disabled={busy !== null}
							>
								<Mail size={14} /> Send test
							</Button>
						)}
						{isDraft && (
							<Button
								variant={pushed ? "primary" : "glass"}
								size="sm"
								onClick={openSchedule}
								disabled={busy !== null}
							>
								<CalendarClock size={14} /> Schedule
							</Button>
						)}
						{isScheduled && (
							<Button variant="glass" size="sm" onClick={handleUnschedule} disabled={busy !== null}>
								{busy === "unschedule" ? <Spinner /> : "Unschedule"}
							</Button>
						)}
						<Button variant="glass" size="sm" onClick={handleSync} disabled={busy !== null}>
							{busy === "sync" ? <Spinner /> : <RefreshCw size={14} />} Sync stats
						</Button>
					</>
				}
			/>

			<div className="space-y-3">
				{/* engagement KPIs */}
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
					<KpiTile kpi={{ key: "sends", label: "Sends", value: sends }} />
					<KpiTile
						kpi={{
							key: "uniqueOpens",
							label: "Unique opens",
							value: uniqueOpens,
							hint: sends > 0 ? `${pct(openRate)} open rate` : undefined,
						}}
					/>
					<KpiTile
						kpi={{
							key: "uniqueClicks",
							label: "Unique clicks",
							value: uniqueClicks,
							hint: sends > 0 ? `${pct(ctr)} CTR` : undefined,
						}}
					/>
					<KpiTile kpi={{ key: "bounces", label: "Bounces", value: stat?.bounces ?? 0 }} />
					<KpiTile kpi={{ key: "optouts", label: "Optouts", value: stat?.optouts ?? 0 }} />
					<GlassCard className="p-4">
						<p className="text-xs font-medium uppercase tracking-wide text-muted">Last synced</p>
						<p className="mt-2 text-lg font-semibold tracking-tight text-emboss">
							{stat?.lastSyncedAt ? fromNow(stat.lastSyncedAt) : "Never"}
						</p>
						{stat?.lastSyncedAt && <p className="mt-1 text-xs text-faint">{fmtDateTime(stat.lastSyncedAt)}</p>}
					</GlassCard>
				</div>

				{/* campaign meta */}
				<GlassCard className="grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
					<MetaField
						label="From"
						value={
							campaign.fromName || campaign.fromEmail
								? `${campaign.fromName ?? ""}${campaign.fromEmail ? ` <${campaign.fromEmail}>` : ""}`.trim()
								: "—"
						}
					/>
					<MetaField label="Reply-to" value={campaign.replyTo ?? "—"} />
					<MetaField label="Segment" value={campaign.segment?.name ?? "—"} />
					<MetaField label="Webinar" value={campaign.webinar?.title ?? "—"} />
					<MetaField
						label="Scheduled for"
						value={campaign.scheduledAt ? fmtDateTime(campaign.scheduledAt) : "—"}
					/>
					<MetaField
						label="Constant Contact"
						value={
							<span className="inline-flex items-center gap-2">
								<Dot tone={pushed ? "ok" : "neutral"} />
								{pushed ? "Pushed" : "Not pushed"}
							</span>
						}
					/>
					<MetaField label="Created" value={fmtDate(campaign.createdAt)} />
				</GlassCard>

				{/* activity drill-down */}
				<Segmented
					items={[
						{ value: "contact" as const, label: "By contact", count: activity.data?.total },
						{ value: "company" as const, label: "By company", count: companyRows.length },
					]}
					value={tab}
					onChange={setTab}
				/>

				{tab === "contact" &&
					(activity.error ? (
						<ErrorState
							title="Couldn't load contact activity"
							message={activity.error}
							onRetry={activity.reload}
						/>
					) : activity.loading && !activity.data ? (
						<Skeleton className="h-96 w-full" />
					) : (
						<>
							<DataTable
								data={contactRows}
								columns={contactColumns}
								searchPlaceholder="Filter this page…"
								pageSize={contactRows.length || CONTACT_PAGE_SIZE}
								initialSorting={[{ id: "clickCount", desc: true }]}
								toolbar={
									<>
										<div className="glass-inset flex h-9 items-center gap-2 rounded-xl px-3">
											<Search size={15} className="text-faint" />
											<input
												value={searchInput}
												onChange={(e) => setSearchInput(e.target.value)}
												placeholder="Search name, email, company…"
												className="w-40 bg-transparent text-sm outline-none placeholder:text-faint sm:w-56"
											/>
										</div>
										<FilterSelect
											label="Engagement"
											value={engagement}
											onChange={setEngagement}
											options={[
												{ value: "opened", label: "Opened" },
												{ value: "clicked", label: "Clicked" },
											]}
										/>
										<Button
											variant="glass"
											size="sm"
											onClick={handleExportCsv}
											disabled={exporting}
											title="Export CSV"
										>
											{exporting ? <Spinner /> : <Download size={15} />} CSV
										</Button>
									</>
								}
							/>
							{contactPageCount > 1 && (
								<div className="flex items-center justify-between gap-2 text-sm text-muted">
									<span className="tnum">
										Page {page} of {contactPageCount} · {num(contactTotal)} contacts
									</span>
									<div className="flex items-center gap-1.5">
										<Button
											variant="glass"
											size="icon"
											onClick={() => setPage((p) => Math.max(1, p - 1))}
											disabled={page <= 1 || activity.loading}
											aria-label="Previous page"
										>
											<ChevronLeft size={16} />
										</Button>
										<Button
											variant="glass"
											size="icon"
											onClick={() => setPage((p) => Math.min(contactPageCount, p + 1))}
											disabled={page >= contactPageCount || activity.loading}
											aria-label="Next page"
										>
											<ChevronRight size={16} />
										</Button>
									</div>
								</div>
							)}
						</>
					))}

				{tab === "company" &&
					(company.loading ? (
						<Skeleton className="h-96 w-full" />
					) : company.error ? (
						<ErrorState
							title="Couldn't load company activity"
							message={company.error}
							onRetry={company.reload}
						/>
					) : (
						<div className="space-y-3">
							{topByClicks.length > 0 && (
								<ChartCard
									title="Top companies by clicks"
									subtitle="Total link clicks across every contact at each company"
								>
									<Bars data={topByClicks} multicolor height={220} />
								</ChartCard>
							)}
							<DataTable
								data={companyRows}
								columns={companyColumns}
								exportName={`campaign-companies-${campaignId}`}
								searchPlaceholder="Search company…"
								pageSize={15}
								initialSorting={[{ id: "clicked", desc: true }]}
							/>
						</div>
					))}
			</div>

			{/* edit (DRAFT only) */}
			<Modal
				open={editOpen}
				onClose={() => setEditOpen(false)}
				title="Edit campaign"
				subtitle="Only drafts can be edited — pushed content is re-sent on the next push."
				size="lg"
				footer={
					<>
						<Button variant="ghost" onClick={() => setEditOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={handleSaveEdit}
							disabled={busy !== null || editForm.name.trim() === "" || editForm.subject.trim() === ""}
						>
							{busy === "save" ? <Spinner /> : "Save changes"}
						</Button>
					</>
				}
			>
				<EditFormFields
					form={editForm}
					setForm={setEditForm}
					segments={options.data?.segments ?? []}
					webinars={options.data?.webinars ?? []}
				/>
			</Modal>

			{/* send test */}
			<Modal
				open={testOpen}
				onClose={() => setTestOpen(false)}
				title="Send test email"
				subtitle="Delivers the current Constant Contact draft to up to 5 addresses."
				footer={
					<>
						<Button variant="ghost" onClick={() => setTestOpen(false)}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleSendTest} disabled={busy !== null || !testValid}>
							{busy === "test" ? <Spinner /> : "Send test"}
						</Button>
					</>
				}
			>
				<div>
					<Label htmlFor="test-emails">Recipients</Label>
					<Input
						id="test-emails"
						value={testEmails}
						onChange={(e) => setTestEmails(e.target.value)}
						placeholder="you@compqsoft.com, teammate@compqsoft.com"
					/>
					<p className="mt-1.5 text-xs text-faint">Up to 5 email addresses, comma-separated.</p>
				</div>
			</Modal>

			{/* schedule */}
			<Modal
				open={scheduleOpen}
				onClose={() => setScheduleOpen(false)}
				title="Schedule campaign"
				subtitle="Constant Contact will send the campaign at this date and time."
				footer={
					<>
						<Button variant="ghost" onClick={() => setScheduleOpen(false)}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={handleSchedule}
							disabled={busy !== null || scheduleAt === ""}
						>
							{busy === "schedule" ? <Spinner /> : "Schedule"}
						</Button>
					</>
				}
			>
				<div>
					<Label htmlFor="schedule-at">Send at</Label>
					<Input
						id="schedule-at"
						type="datetime-local"
						value={scheduleAt}
						min={toLocalInput(new Date().toISOString())}
						onChange={(e) => setScheduleAt(e.target.value)}
					/>
					{!pushed && (
						<p className="mt-1.5 text-xs text-[var(--warn)]">
							{"This campaign hasn't been pushed to Constant Contact yet — push it first."}
						</p>
					)}
				</div>
			</Modal>
		</>
	);
}
