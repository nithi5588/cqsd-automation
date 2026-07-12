"use client";

import { Copy, RefreshCw, Send, Upload, Video } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import type { AttendanceImportRow } from "@/lib/api/webinars";
import { ChartCard, Donut } from "@/components/charts";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, Dot, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { GlassCard, SectionTitle } from "@/components/ui/glass";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { Segmented } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useApi";
import { API_BASE_URL, ApiError, webinarsApi } from "@/lib/api";
import { dur, fmtDateTime, fromNow, num, titleCase } from "@/lib/format";
import type {
	AccountPlanContactRow,
	AttendanceRow,
	Paginated,
	RegistrationRow,
	WebinarAccountPlan,
	WebinarAttendanceResponse,
	WebinarCampaignRow,
} from "@/types/domain";
import type { Kpi } from "@/types/ui";

type Tab = "registrations" | "attendance" | "campaigns" | "plan";

const errMsg = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong");

interface ParsedAttendanceFile {
	rows: AttendanceImportRow[];
	skippedNoEmail: number;
	skippedOrganizers: number;
}

/** Decodes the raw file: Teams exports UTF-16 LE (BOM FF FE); everything else is treated as UTF-8. */
async function decodeAttendanceFile(file: File): Promise<string> {
	const buf = await file.arrayBuffer();
	const bytes = new Uint8Array(buf);
	if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
		return new TextDecoder("utf-16le").decode(buf);
	}
	if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
		return new TextDecoder("utf-16be").decode(buf);
	}
	return new TextDecoder("utf-8").decode(buf);
}

/** Splits one delimited line, honouring double-quoted values (for comma CSVs). */
function splitLine(line: string, sep: string): string[] {
	if (sep === "\t") return line.split("\t").map((v) => v.trim());
	const out: string[] = [];
	let cur = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuotes) {
			if (ch === '"' && line[i + 1] === '"') {
				cur += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				cur += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === sep) {
			out.push(cur.trim());
			cur = "";
		} else {
			cur += ch;
		}
	}
	out.push(cur.trim());
	return out;
}

/** "1h 2m 30s" / "45m 12s" / "38s" → seconds; bare numbers pass through as seconds. */
function parseDurationText(value: string): number | undefined {
	const text = value.trim().toLowerCase();
	if (!text) return undefined;
	if (/^\d+$/.test(text)) return Number(text);
	let seconds = 0;
	let matched = false;
	for (const [, amount, unit] of text.matchAll(/(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)/g)) {
		matched = true;
		const n = Number(amount);
		if (unit.startsWith("h")) seconds += n * 3600;
		else if (unit.startsWith("m")) seconds += n * 60;
		else seconds += n;
	}
	return matched ? seconds : undefined;
}

function parseDateText(value: string): string | undefined {
	const text = value.trim();
	if (!text) return undefined;
	const parsed = new Date(text);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

const HEADER_ALIASES: Record<keyof AttendanceImportRow | "role", string[]> = {
	name: ["full name", "name", "attendee", "display name"],
	email: ["email", "email address", "e-mail", "participant id (upn)", "participant id", "upn"],
	joinTime: ["first join", "first join time", "join time", "joined at", "join"],
	leaveTime: ["last leave", "last leave time", "leave time", "left at", "leave"],
	durationSeconds: ["in-meeting duration", "duration", "attendance duration", "time in meeting"],
	role: ["role"],
};

function matchHeader(cells: string[]): Map<string, number> | null {
	const lowered = cells.map((c) => c.replace(/^﻿/, "").trim().toLowerCase());
	const map = new Map<string, number>();
	for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
		const idx = lowered.findIndex((cell) => aliases.includes(cell));
		if (idx >= 0) map.set(field, idx);
	}
	// A usable header needs at least an email-ish column plus one other signal.
	return map.has("email") && map.size >= 2 ? map : null;
}

/**
 * Parses the attendance report Teams lets organizers download (UTF-16 +
 * tab-separated, with "1. Summary / 2. Participants / …" sections) as well as
 * plain single-table CSVs with name/email/join/leave/duration columns.
 */
function parseAttendanceReport(text: string): ParsedAttendanceFile {
	const lines = text.split(/\r\n|\n|\r/);
	const sep = text.includes("\t") ? "\t" : ",";

	let header: Map<string, number> | null = null;
	let skippedNoEmail = 0;
	let skippedOrganizers = 0;
	const byEmail = new Map<string, AttendanceImportRow>();

	for (const line of lines) {
		if (!line.trim()) {
			// Blank line ends a section in the Teams multi-section report.
			if (header) header = null;
			continue;
		}
		const cells = splitLine(line, sep);
		if (!header) {
			header = matchHeader(cells);
			continue;
		}

		const get = (field: string) => {
			const idx = header?.get(field);
			return idx !== undefined ? (cells[idx] ?? "") : "";
		};

		const role = get("role").toLowerCase();
		if (role === "organizer" || role === "organiser") {
			skippedOrganizers++;
			continue;
		}

		const email = get("email").toLowerCase();
		if (!email || !email.includes("@")) {
			skippedNoEmail++;
			continue;
		}

		const row: AttendanceImportRow = {
			email,
			name: get("name") || undefined,
			joinTime: parseDateText(get("joinTime")),
			leaveTime: parseDateText(get("leaveTime")),
			durationSeconds: parseDurationText(get("durationSeconds")),
		};

		// Same person can appear once per join — keep the widest window / longest stay.
		const existing = byEmail.get(email);
		if (!existing) {
			byEmail.set(email, row);
		} else {
			byEmail.set(email, {
				email,
				name: existing.name ?? row.name,
				joinTime:
					existing.joinTime && row.joinTime
						? existing.joinTime < row.joinTime
							? existing.joinTime
							: row.joinTime
						: (existing.joinTime ?? row.joinTime),
				leaveTime:
					existing.leaveTime && row.leaveTime
						? existing.leaveTime > row.leaveTime
							? existing.leaveTime
							: row.leaveTime
						: (existing.leaveTime ?? row.leaveTime),
				durationSeconds: (existing.durationSeconds ?? 0) + (row.durationSeconds ?? 0) || undefined,
			});
		}
	}

	return { rows: [...byEmail.values()], skippedNoEmail, skippedOrganizers };
}

/** Small icon button that copies a value to the clipboard. */
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

function TabError({ title, hint, onRetry }: { title: string; hint: string; onRetry: () => void }) {
	return (
		<GlassCard>
			<EmptyState title={title} hint={hint} />
			<div className="flex justify-center pb-8">
				<Button onClick={onRetry}>Retry</Button>
			</div>
		</GlassCard>
	);
}

export default function WebinarDetailPage() {
	const { id } = useParams<{ id: string }>();
	const { token } = useAuth();
	const toast = useToast();
	const router = useRouter();

	const [tab, setTab] = useState<Tab>("registrations");
	// Lazy tab data: each list only fetches on the first activation of its tab
	// (registrations is the default tab, so it fetches immediately).
	const [visited, setVisited] = useState<Record<Tab, boolean>>({
		registrations: true,
		attendance: false,
		campaigns: false,
		plan: false,
	});

	const openTab = (t: Tab) => {
		setTab(t);
		setVisited((v) => (v[t] ? v : { ...v, [t]: true }));
	};

	// Only the detail fetch is eager — tab counts come from its registrationCount/attendanceCount.
	const detail = useAsyncData(() => webinarsApi.get(token, id), [token, id]);
	const regs = useAsyncData<Paginated<RegistrationRow> | null>(
		() =>
			visited.registrations
				? webinarsApi.registrations(token, id, { pageSize: 200 })
				: Promise.resolve(null),
		[token, id, visited.registrations],
	);
	const att = useAsyncData<WebinarAttendanceResponse | null>(
		() =>
			visited.attendance
				? webinarsApi.attendance(token, id, { pageSize: 200 })
				: Promise.resolve(null),
		[token, id, visited.attendance],
	);
	const plan = useAsyncData<WebinarAccountPlan | null>(
		() => (visited.plan ? webinarsApi.accountPlan(token, id) : Promise.resolve(null)),
		[token, id, visited.plan],
	);

	const [publishOpen, setPublishOpen] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [syncing, setSyncing] = useState(false);

	const [importOpen, setImportOpen] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importFileName, setImportFileName] = useState<string | null>(null);
	const [importParsed, setImportParsed] = useState<ParsedAttendanceFile | null>(null);
	const [importParseError, setImportParseError] = useState<string | null>(null);

	const copy = (value: string, label: string) => {
		navigator.clipboard
			.writeText(value)
			.then(() => toast(`${label} copied to clipboard`))
			.catch(() => toast("Copy failed", "warn"));
	};

	async function handlePublish() {
		setPublishing(true);
		try {
			await webinarsApi.publish(token, id);
			toast("Webinar published to Teams");
			setPublishOpen(false);
			detail.reload();
		} catch (err) {
			// Commonly: Microsoft not connected, or a Graph 403 (organizer lacks a
			// Teams virtual-events policy) — surface the API message verbatim.
			toast(errMsg(err), "warn");
		} finally {
			setPublishing(false);
		}
	}

	async function handleImportFile(file: File) {
		setImportFileName(file.name);
		setImportParsed(null);
		setImportParseError(null);
		try {
			if (/\.xlsx?$/i.test(file.name)) {
				setImportParseError(
					"Excel files aren't supported directly — open it in Excel and use File → Save As → CSV, or upload the original file downloaded from Teams.",
				);
				return;
			}
			const text = await decodeAttendanceFile(file);
			const parsed = parseAttendanceReport(text);
			if (parsed.rows.length === 0) {
				setImportParseError(
					"No attendee rows found. Upload the attendance report downloaded from Teams (it needs Name/Email columns).",
				);
				return;
			}
			setImportParsed(parsed);
		} catch {
			setImportParseError("Couldn't read that file — upload the CSV downloaded from Teams.");
		}
	}

	async function handleImportSubmit() {
		if (!importParsed) return;
		setImporting(true);
		try {
			const result = await webinarsApi.importAttendance(token, id, importParsed.rows);
			toast(
				`Imported ${num(result.imported)} attendees (${num(result.matchedContacts)} matched to contacts)`,
			);
			setImportOpen(false);
			setImportParsed(null);
			setImportFileName(null);
			att.reload();
			detail.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setImporting(false);
		}
	}

	async function handleSyncAttendance() {
		setSyncing(true);
		try {
			const result = await webinarsApi.syncAttendance(token, id);
			toast(`Synced ${num(result.synced)} attendance records (${num(result.matchedContacts)} matched contacts)`);
			att.reload();
			detail.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setSyncing(false);
		}
	}

	if (detail.loading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-16 w-2/3" />
				<KpiGrid loading count={4} />
				<Skeleton className="h-40" />
				<Skeleton className="h-72" />
			</div>
		);
	}

	if (detail.error || !detail.data) {
		return (
			<GlassCard>
				<EmptyState
					icon={<Video size={28} />}
					title="Couldn't load webinar"
					hint={detail.error ?? "Webinar not found"}
				/>
				<div className="flex justify-center pb-8">
					<Button onClick={detail.reload}>Retry</Button>
				</div>
			</GlassCard>
		);
	}

	const w = detail.data.webinar;
	const summary = att.data?.summary;

	// Attendance summary loads lazily when its tab opens — until then, KPIs come from the detail.
	const kpis: Kpi[] = summary
		? [
				{ key: "registrations", label: "Registrations", value: summary.registrations },
				{ key: "attended", label: "Attended", value: summary.total },
				{ key: "showRate", label: "Show rate", value: Math.round(summary.showRate * 1000) / 10, unit: "%" },
				{
					key: "avgDuration",
					label: "Avg duration",
					value: Math.round(summary.avgDurationSeconds / 60),
					unit: "min",
					hint: dur(summary.avgDurationSeconds),
				},
			]
		: [
				{ key: "registrations", label: "Registrations", value: w.registrationCount },
				{ key: "attended", label: "Attended", value: w.attendanceCount },
				{
					key: "showRate",
					label: "Show rate",
					value: w.registrationCount > 0 ? Math.round((w.attendanceCount / w.registrationCount) * 100) : 0,
					unit: "%",
				},
				{ key: "avgDuration", label: "Avg duration", value: 0, unit: "min", hint: "Open Attendance to compute" },
			];

	const registrationPageUrl =
		typeof window !== "undefined"
			? `${window.location.origin}/register/${w.slug}`
			: `/register/${w.slug}`;

	const snippet = [
		`POST ${API_BASE_URL}/public/webinars/${w.slug}/register`,
		"Content-Type: application/json",
		"",
		"{",
		'	"name": "Jane Smith",',
		'	"email": "jane.smith@example.com",',
		'	"company": "Acme Corp"',
		"}",
	].join("\n");

	const regColumns: ColumnDef<RegistrationRow>[] = [
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ row }) => <span className="font-medium text-fg">{row.original.name}</span>,
		},
		{ accessorKey: "email", header: "Email" },
		{
			accessorKey: "source",
			header: "Source",
			cell: ({ row }) => (
				<Badge tone={row.original.source === "TEAMS" ? "info" : "ok"}>{titleCase(row.original.source)}</Badge>
			),
		},
		{
			accessorKey: "registeredAt",
			header: "Registered",
			cell: ({ row }) => <span className="tnum">{fmtDateTime(row.original.registeredAt)}</span>,
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

	const attColumns: ColumnDef<AttendanceRow>[] = [
		{
			accessorKey: "email",
			header: "Attendee",
			cell: ({ row }) => (
				<div>
					<div className="font-medium text-fg">{row.original.name ?? "—"}</div>
					<div className="text-xs text-muted">{row.original.email}</div>
				</div>
			),
		},
		{
			accessorKey: "joinTime",
			header: "Joined",
			cell: ({ row }) => (
				<span className="tnum">{row.original.joinTime ? fmtDateTime(row.original.joinTime) : "—"}</span>
			),
		},
		{
			accessorKey: "leaveTime",
			header: "Left",
			cell: ({ row }) => (
				<span className="tnum">{row.original.leaveTime ? fmtDateTime(row.original.leaveTime) : "—"}</span>
			),
		},
		{
			accessorKey: "durationSeconds",
			header: "Duration",
			cell: ({ row }) => <span className="tnum">{dur(row.original.durationSeconds)}</span>,
		},
		{
			accessorKey: "attended",
			header: "Attended",
			cell: ({ row }) => <Dot tone={row.original.attended ? "ok" : "danger"} />,
		},
		{
			accessorKey: "registered",
			header: "Registered",
			cell: ({ row }) => <Dot tone={row.original.registered ? "ok" : "neutral"} />,
		},
	];

	const campaignColumns: ColumnDef<WebinarCampaignRow>[] = [
		{
			accessorKey: "name",
			header: "Campaign",
			cell: ({ row }) => <span className="font-medium text-fg">{row.original.name}</span>,
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => <StatusPill status={row.original.status} />,
		},
		{
			accessorKey: "volumeNumber",
			header: "Volume",
			cell: ({ row }) => (row.original.volumeNumber != null ? `Vol ${row.original.volumeNumber}` : "—"),
		},
		{
			id: "sends",
			header: "Sends",
			cell: ({ row }) => <span className="tnum">{num(row.original.stat?.sends ?? 0)}</span>,
		},
		{
			id: "uniqueOpens",
			header: "Unique opens",
			cell: ({ row }) => <span className="tnum">{num(row.original.stat?.uniqueOpens ?? 0)}</span>,
		},
		{
			id: "uniqueClicks",
			header: "Unique clicks",
			cell: ({ row }) => <span className="tnum">{num(row.original.stat?.uniqueClicks ?? 0)}</span>,
		},
	];

	const planContactColumns: ColumnDef<AccountPlanContactRow>[] = [
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

	const personaData =
		plan.data?.personas.map((p) => ({ name: titleCase(p.persona), value: p.contacts })) ?? [];

	return (
		<div className="space-y-4">
			<PageHeader
				title={w.title}
				subtitle={`${fmtDateTime(w.startsAt)} → ${fmtDateTime(w.endsAt)} · ${w.timeZone}`}
				actions={
					<>
						<StatusPill status={w.status} />
						{w.joinUrl && (
							<Button variant="glass" size="sm" onClick={() => copy(w.joinUrl as string, "Join URL")}>
								<Copy size={14} /> Join URL
							</Button>
						)}
						{w.registrationUrl && (
							<Button
								variant="glass"
								size="sm"
								onClick={() => copy(w.registrationUrl as string, "Registration URL")}
							>
								<Copy size={14} /> Registration URL
							</Button>
						)}
						{w.status === "DRAFT" && (
							<Button variant="primary" size="sm" onClick={() => setPublishOpen(true)}>
								<Send size={14} /> Publish to Teams
							</Button>
						)}
					</>
				}
			/>

			<KpiGrid kpis={kpis} count={4} />

			<GlassCard className="p-4">
				<SectionTitle
					title="Registration page"
					subtitle="Share this link in emails, LinkedIn posts or the website — registrants land on a branded sign-up page and are saved here automatically."
					right={
						<div className="flex items-center gap-2">
							<Button variant="glass" size="sm" onClick={() => copy(registrationPageUrl, "Registration link")}>
								<Copy size={14} /> Copy link
							</Button>
							<Button
								variant="primary"
								size="sm"
								onClick={() => window.open(registrationPageUrl, "_blank", "noopener")}
							>
								Open page
							</Button>
						</div>
					}
				/>
				<p className="tnum mt-3 truncate rounded-lg border border-hairline bg-[var(--accent-soft)] px-3 py-2 text-[13px] text-fg">
					{registrationPageUrl}
				</p>
				<details className="mt-3">
					<summary className="cursor-pointer text-xs font-medium text-muted hover:text-fg">
						For developers — direct API endpoint (embedding a custom form on the website)
					</summary>
					<pre className="glass-inset mt-2 overflow-x-auto rounded-xl p-3 text-xs leading-relaxed text-fg">
						<code>{snippet}</code>
					</pre>
				</details>
			</GlassCard>

			<Segmented<Tab>
				value={tab}
				onChange={openTab}
				items={[
					{ value: "registrations", label: "Registrations", count: w.registrationCount },
					{ value: "attendance", label: "Attendance", count: w.attendanceCount },
					{ value: "campaigns", label: "Campaigns", count: w.campaigns.length },
					{ value: "plan", label: "Account plan" },
				]}
			/>

			{tab === "registrations" &&
				(regs.error ? (
					<TabError title="Couldn't load registrations" hint={regs.error} onRetry={regs.reload} />
				) : regs.loading || !regs.data ? (
					<Skeleton className="h-72" />
				) : (
					<DataTable
						data={regs.data.items}
						columns={regColumns}
						searchPlaceholder="Search registrations…"
						initialSorting={[{ id: "registeredAt", desc: true }]}
					/>
				))}

			{tab === "attendance" &&
				(att.error ? (
					<TabError title="Couldn't load attendance" hint={att.error} onRetry={att.reload} />
				) : att.loading || !att.data ? (
					<Skeleton className="h-72" />
				) : (
					<DataTable
						data={att.data.items}
						columns={attColumns}
						searchPlaceholder="Search attendance…"
						initialSorting={[{ id: "durationSeconds", desc: true }]}
						toolbar={
							<>
								<Button variant="glass" size="sm" onClick={() => setImportOpen(true)}>
									<Upload size={14} /> Import CSV
								</Button>
								<Button variant="glass" size="sm" onClick={handleSyncAttendance} disabled={syncing}>
									{syncing ? <Spinner /> : <RefreshCw size={14} />} Sync attendance
								</Button>
							</>
						}
					/>
				))}

			{tab === "campaigns" && (
				<DataTable
					data={w.campaigns}
					columns={campaignColumns}
					searchPlaceholder="Search campaigns…"
					onRowClick={(row) => router.push(`/campaigns/${row.id}`)}
				/>
			)}

			{tab === "plan" &&
				(plan.error ? (
					<TabError title="Couldn't load account plan" hint={plan.error} onRetry={plan.reload} />
				) : plan.loading || !plan.data ? (
					<Skeleton className="h-72" />
				) : plan.data ? (
					<div className="space-y-3">
						<div className="grid gap-3 lg:grid-cols-3">
							<ChartCard title="Personas" subtitle="Engaged contacts by persona">
								{personaData.length > 0 ? (
									<Donut data={personaData} height={200} />
								) : (
									<EmptyState title="No persona data" hint="No contacts engaged with this webinar yet." />
								)}
							</ChartCard>
							<GlassCard className="p-4 lg:col-span-2">
								<SectionTitle title="Engagement totals" subtitle="Scoped to this webinar's campaigns and attendance" />
								<dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
									{[
										{ label: "Contacts", value: num(plan.data.totals.contacts) },
										{ label: "Emails sent", value: num(plan.data.totals.emailsSent) },
										{ label: "Unique opens", value: num(plan.data.totals.uniqueOpens) },
										{ label: "Unique clicks", value: num(plan.data.totals.uniqueClicks) },
										{ label: "Webinars attended", value: num(plan.data.totals.webinarsAttended) },
										{ label: "Time attended", value: dur(plan.data.totals.attendedSeconds) },
									].map((s) => (
										<div key={s.label} className="glass-inset rounded-xl p-3">
											<dt className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</dt>
											<dd className="tnum mt-1 text-lg font-semibold text-emboss">{s.value}</dd>
										</div>
									))}
								</dl>
							</GlassCard>
						</div>
						<DataTable
							data={plan.data.contacts}
							columns={planContactColumns}
							searchPlaceholder="Search contacts…"
							exportName={`webinar-${w.slug}-account-plan`}
						/>
					</div>
				) : null)}

			<Modal
				open={importOpen}
				onClose={() => !importing && setImportOpen(false)}
				title="Import attendance from Teams"
				subtitle="Upload the attendance report downloaded from the Teams meeting"
				footer={
					<>
						<Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importing}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={handleImportSubmit}
							disabled={importing || !importParsed}
						>
							{importing ? <Spinner /> : <Upload size={14} />}
							{importParsed ? `Import ${num(importParsed.rows.length)} attendees` : "Import"}
						</Button>
					</>
				}
			>
				<div className="space-y-3 text-sm">
					<p className="text-muted">
						In Teams: open the meeting → <span className="font-medium text-fg">Attendance</span> tab →{" "}
						<span className="font-medium text-fg">Download</span>. Upload that file here as-is — attendees
						are matched to contacts by email, and show rates + account plans update automatically.
					</p>
					<label className="block cursor-pointer rounded-lg border border-dashed border-hairline-strong p-6 text-center text-muted transition-colors hover:border-[var(--accent)] hover:text-fg">
						<input
							type="file"
							accept=".csv,.tsv,.txt"
							className="hidden"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) void handleImportFile(file);
								e.target.value = "";
							}}
						/>
						<Upload size={18} className="mx-auto mb-2" />
						{importFileName ?? "Click to choose the attendance CSV"}
					</label>
					{importParseError && (
						<p className="rounded-lg border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-3 py-2 text-xs">
							{importParseError}
						</p>
					)}
					{importParsed && (
						<div className="space-y-1 rounded-lg border border-hairline bg-[var(--accent-soft)] px-3 py-2 text-xs">
							<p className="font-medium text-fg">
								{num(importParsed.rows.length)} attendees ready to import
							</p>
							{importParsed.skippedOrganizers > 0 && (
								<p className="text-muted">{num(importParsed.skippedOrganizers)} organizer rows skipped</p>
							)}
							{importParsed.skippedNoEmail > 0 && (
								<p className="text-muted">
									{num(importParsed.skippedNoEmail)} rows without an email skipped
								</p>
							)}
							<p className="text-muted">
								Preview:{" "}
								{importParsed.rows
									.slice(0, 3)
									.map((r) => r.email)
									.join(", ")}
								{importParsed.rows.length > 3 ? "…" : ""}
							</p>
						</div>
					)}
				</div>
			</Modal>

			<Modal
				open={publishOpen}
				onClose={() => setPublishOpen(false)}
				title="Publish to Microsoft Teams"
				subtitle="Creates and publishes the webinar via Microsoft Graph"
				footer={
					<>
						<Button variant="ghost" onClick={() => setPublishOpen(false)} disabled={publishing}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handlePublish} disabled={publishing}>
							{publishing ? <Spinner /> : <Send size={16} />} Publish
						</Button>
					</>
				}
			>
				<div className="space-y-3 text-sm text-muted">
					<p>
						This creates the webinar in Microsoft Teams (organizer{" "}
						<span className="font-medium text-fg">{w.organizerUpn}</span>) and immediately publishes it via
						Microsoft Graph. Once published, the Teams registration page goes live and join links become
						available.
					</p>
					<p className="rounded-lg border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-3 py-2 text-xs">
						Requires the Microsoft connection (see Connections) and a Teams virtual-events policy that allows
						the organizer to host webinars — otherwise Graph rejects the request (commonly a 403).
					</p>
				</div>
			</Modal>
		</div>
	);
}
