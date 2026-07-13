"use client";

import {
	Activity,
	ArrowUpRight,
	Building2,
	CalendarClock,
	Eye,
	Funnel,
	Import,
	Mail,
	MailWarning,
	MousePointerClick,
	Pencil,
	Plug,
	Plus,
	RefreshCw,
	TriangleAlert,
	Users,
	Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AreaTrend, BarList, Bars, ChartCard, FunnelBars } from "@/components/charts";
import { useAuth } from "@/components/providers/AuthProvider";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, Dot, StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass";
import { KpiGrid } from "@/components/ui/kpi-grid";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useAsyncData } from "@/hooks/useApi";
import { overviewApi } from "@/lib/api";
import { fmtDateTime, fromNow, num, pct } from "@/lib/format";
import type { Tone } from "@/lib/status";
import type {
	CampaignListItem,
	OverviewData,
	OverviewKpis,
	PersonaBucket,
	WebinarListItem,
} from "@/types/domain";
import type { Kpi, NameValue, TrendPoint } from "@/types/ui";

/** Ratio (0–1) → percent number with pct()-style rounding, for KpiTile's "%" unit. */
function pctValue(rate: number | null): number {
	if (rate == null || !Number.isFinite(rate)) return 0;
	const v = rate * 100;
	return Math.abs(v) < 10 ? Math.round(v * 10) / 10 : Math.round(v);
}

function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

const PERSONA_LABEL: Record<PersonaBucket, string> = {
	IT: "IT",
	LINE_OF_BUSINESS: "Line of business",
	CUSTOMER_SERVICE: "Customer service",
	UNKNOWN: "No persona",
};

/** Audit action → badge tone (created/sent = ok, deletes/failures = danger, edits = info). */
function actionTone(action: string): Tone {
	const a = action.toLowerCase();
	if (a.includes("delete") || a.includes("fail") || a.includes("cancel") || a.includes("bounce")) return "danger";
	if (a.includes("create") || a.includes("import") || a.includes("send") || a.includes("publish")) return "ok";
	if (a.includes("update") || a.includes("sync") || a.includes("schedule") || a.includes("edit")) return "info";
	return "neutral";
}

function buildKpis(kpis: OverviewKpis): Kpi[] {
	return [
		{ key: "contacts", label: "Contacts", value: kpis.contacts, icon: <Users size={15} />, tone: "brand" },
		{ key: "companies", label: "Companies", value: kpis.organizations, icon: <Building2 size={15} />, tone: "info" },
		{
			key: "campaignsSent",
			label: "Campaigns sent",
			value: kpis.campaignsSent,
			icon: <Mail size={15} />,
			tone: "brand",
		},
		{
			key: "openRate",
			label: "Avg open rate",
			value: pctValue(kpis.avgOpenRate),
			unit: "%",
			hint: kpis.avgOpenRate == null ? "No campaign stats yet" : undefined,
			icon: <Eye size={15} />,
			tone: "ok",
		},
		{
			key: "clickRate",
			label: "Avg click rate",
			value: pctValue(kpis.avgClickRate),
			unit: "%",
			hint: kpis.avgClickRate == null ? "No campaign stats yet" : undefined,
			icon: <MousePointerClick size={15} />,
			tone: "ok",
		},
		{
			key: "upcomingWebinars",
			label: "Upcoming webinars",
			value: kpis.upcomingWebinars,
			icon: <Video size={15} />,
			tone: "warn",
		},
	];
}

function missingProvidersMessage(kpis: OverviewKpis): string {
	const missing = [
		!kpis.ccConnected ? "Constant Contact" : null,
		!kpis.msConnected ? "Microsoft Teams" : null,
	].filter((name): name is string => name != null);
	return `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not connected`;
}

/** GlassCard with a section header and a "View all" link — for the mini list tables. */
function ListCard({
	title,
	subtitle,
	href,
	children,
}: {
	title: string;
	subtitle?: string;
	href: string;
	children: React.ReactNode;
}) {
	return (
		<GlassCard className="flex flex-col overflow-hidden">
			<div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
				<div className="flex items-start gap-2">
					<span className="mt-0.5 h-4 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
					<div>
						<h3 className="text-sm font-semibold tracking-tight text-emboss">{title}</h3>
						{subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
					</div>
				</div>
				<Link
					href={href}
					className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted transition hover:text-fg"
				>
					View all <ArrowUpRight size={13} />
				</Link>
			</div>
			<div className="min-h-0 flex-1">{children}</div>
		</GlassCard>
	);
}

const TH = "whitespace-nowrap px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted";
const THR = "whitespace-nowrap px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted";

function RecentCampaignsTable({ campaigns }: { campaigns: CampaignListItem[] }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[480px] border-collapse text-sm">
				<thead>
					<tr className="border-b border-hairline">
						<th className={TH}>Campaign</th>
						<th className={TH}>Status</th>
						<th className={THR}>Sends</th>
						<th className={THR}>Opens</th>
						<th className={THR}>Clicks</th>
					</tr>
				</thead>
				<tbody>
					{campaigns.map((c) => (
						<tr key={c.id} className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-[var(--accent-soft)]">
							<td className="max-w-[240px] truncate px-4 py-2.5">
								<Link href={`/campaigns/${c.id}`} className="font-medium text-fg hover:underline">
									{c.name}
								</Link>
							</td>
							<td className="whitespace-nowrap px-4 py-2.5">
								<StatusPill status={c.status} />
							</td>
							<td className="tnum whitespace-nowrap px-4 py-2.5 text-right">{c.stat ? num(c.stat.sends) : "—"}</td>
							<td className="tnum whitespace-nowrap px-4 py-2.5 text-right">{c.stat ? num(c.stat.opens) : "—"}</td>
							<td className="tnum whitespace-nowrap px-4 py-2.5 text-right">{c.stat ? num(c.stat.clicks) : "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function UpcomingWebinarsTable({ webinars }: { webinars: WebinarListItem[] }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[420px] border-collapse text-sm">
				<thead>
					<tr className="border-b border-hairline">
						<th className={TH}>Webinar</th>
						<th className={TH}>Starts</th>
						<th className={TH}>Status</th>
						<th className={THR}>Registered</th>
					</tr>
				</thead>
				<tbody>
					{webinars.map((w) => (
						<tr key={w.id} className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-[var(--accent-soft)]">
							<td className="max-w-[220px] truncate px-4 py-2.5">
								<Link href={`/webinars/${w.id}`} className="font-medium text-fg hover:underline">
									{w.title}
								</Link>
							</td>
							<td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDateTime(w.startsAt)}</td>
							<td className="whitespace-nowrap px-4 py-2.5">
								<StatusPill status={w.status} />
							</td>
							<td className="tnum whitespace-nowrap px-4 py-2.5 text-right">{num(w.registrationCount)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Compact 12px value list rendered under a chart so every value is readable as text. */
function ChartValueList({ rows }: { rows: Array<{ key: string; label: string; value: string }> }) {
	return (
		<ul className="mt-3 space-y-1 border-t border-hairline pt-2.5">
			{rows.map((r) => (
				<li key={r.key} className="flex items-center justify-between gap-2 text-[12px] leading-5">
					<span className="truncate text-muted">{r.label}</span>
					<span className="tnum shrink-0 font-medium text-fg">{r.value}</span>
				</li>
			))}
		</ul>
	);
}

/** One linked row in the "Needs attention" card. */
function AttentionRow({
	href,
	icon,
	label,
	sub,
	count,
}: {
	href: string;
	icon: React.ReactNode;
	label: string;
	sub?: string;
	count: number;
}) {
	return (
		<Link
			href={href}
			className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--accent-soft)]"
		>
			<span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--accent-soft)] text-brand">
				{icon}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-[13px] font-medium text-fg">{label}</span>
				{sub && <span className="block truncate text-[11px] text-muted">{sub}</span>}
			</span>
			<span className="tnum shrink-0 text-[13px] font-semibold text-fg">{num(count)}</span>
			<ArrowUpRight size={13} className="shrink-0 text-faint transition-colors group-hover:text-fg" />
		</Link>
	);
}

export default function OverviewPage() {
	const { token } = useAuth();
	const router = useRouter();

	const { data, loading, error, reload } = useAsyncData<OverviewData>(
		() => (token ? overviewApi.get(token) : new Promise<OverviewData>(() => {})),
		[token],
	);

	const kpis = data ? buildKpis(data.kpis) : undefined;
	const trend: TrendPoint[] = (data?.engagementTrend ?? []).map((p) => ({
		date: p.date,
		value: p.opens,
		value2: p.clicks,
	}));
	const hasEngagement = trend.some((p) => p.value > 0 || (p.value2 ?? 0) > 0);
	const topCompanies: NameValue[] = (data?.topCompanies ?? []).map((c) => ({
		name: c.name,
		value: c.uniqueClicks,
	}));

	// ---- funnel -----------------------------------------------------------
	const funnel = data?.funnel;
	const funnelData: NameValue[] = funnel
		? [
				{ name: "Emails sent", value: funnel.sends },
				{ name: "Unique opens", value: funnel.uniqueOpens },
				{ name: "Unique clicks", value: funnel.uniqueClicks },
				{ name: "Registrations", value: funnel.registrations },
				{ name: "Attendees", value: funnel.attendees },
			]
		: [];

	// ---- campaign performance (open rate %, single series) -----------------
	const campaignPerf = data?.campaignPerformance ?? [];
	const campaignBars: NameValue[] = campaignPerf.map((c) => ({
		name: c.volumeNumber != null ? `Vol ${c.volumeNumber}` : truncate(c.name, 12),
		value: pctValue(c.openRate),
	}));
	const campaignRows = campaignPerf.map((c) => ({
		key: c.campaignId,
		label: truncate(c.volumeNumber != null ? `Vol ${c.volumeNumber} · ${c.name}` : c.name, 30),
		value: `${c.openRate != null ? pct(c.openRate) : "—"} open · ${c.clickRate != null ? pct(c.clickRate) : "—"} click`,
	}));

	// ---- webinar show rate (%, single series) -------------------------------
	const showRates = data?.webinarShowRates ?? [];
	const showRateBars: NameValue[] = showRates.map((w) => ({
		name: truncate(w.title, 18),
		value: w.registrations > 0 ? pctValue(w.attended / w.registrations) : 0,
	}));
	const showRateRows = showRates.map((w) => ({
		key: w.webinarId,
		label: truncate(w.title, 30),
		value: `${num(w.attended)}/${num(w.registrations)}`,
	}));

	// ---- personas (single-hue horizontal bars) ------------------------------
	const personas = data?.personas ?? [];
	const personaBars: NameValue[] = personas
		.filter((p) => p.persona !== "UNKNOWN" || p.contacts > 0)
		.map((p) => ({ name: PERSONA_LABEL[p.persona], value: p.contacts }));
	const hasPersonaContacts = personas.some((p) => p.contacts > 0);

	// ---- needs attention ----------------------------------------------------
	const attention = data?.attention;
	const attentionRows = attention
		? [
				attention.draftCampaigns > 0 && (
					<AttentionRow
						key="drafts"
						href="/campaigns"
						icon={<Pencil size={14} />}
						label={attention.draftCampaigns === 1 ? "Draft campaign" : "Draft campaigns"}
						sub="Unfinished, not yet scheduled"
						count={attention.draftCampaigns}
					/>
				),
				attention.scheduledCampaigns > 0 && (
					<AttentionRow
						key="scheduled"
						href="/campaigns"
						icon={<CalendarClock size={14} />}
						label={attention.scheduledCampaigns === 1 ? "Scheduled campaign" : "Scheduled campaigns"}
						sub={attention.nextScheduledAt ? `Next: ${fmtDateTime(attention.nextScheduledAt)}` : undefined}
						count={attention.scheduledCampaigns}
					/>
				),
				attention.completedWebinarsWithoutAttendance > 0 && (
					<AttentionRow
						key="webinars"
						href="/webinars"
						icon={<Video size={14} />}
						label={
							attention.completedWebinarsWithoutAttendance === 1
								? "Completed webinar missing attendance"
								: "Completed webinars missing attendance"
						}
						sub="Sync attendance from Teams"
						count={attention.completedWebinarsWithoutAttendance}
					/>
				),
				attention.bouncedContacts > 0 && (
					<AttentionRow
						key="bounced"
						href="/contacts"
						icon={<MailWarning size={14} />}
						label={attention.bouncedContacts === 1 ? "Bounced contact" : "Bounced contacts"}
						sub="Excluded from segments and sends"
						count={attention.bouncedContacts}
					/>
				),
			].filter((row): row is React.ReactElement => row !== false)
		: [];

	const recentActivity = data?.recentActivity ?? [];

	return (
		<>
			<PageHeader
				title="Overview"
				subtitle="Marketing performance across contacts, campaigns and webinars."
				actions={
					<>
						<Button variant="glass" size="sm" onClick={reload} disabled={loading} aria-label="Refresh">
							<RefreshCw size={15} />
						</Button>
						<Button variant="glass" size="sm" onClick={() => router.push("/contacts")}>
							<Import size={15} /> Import contacts
						</Button>
						<Button variant="glass" size="sm" onClick={() => router.push("/webinars")}>
							<Video size={15} /> New webinar
						</Button>
						<Button variant="primary" size="sm" onClick={() => router.push("/campaigns")}>
							<Plus size={15} /> New campaign
						</Button>
					</>
				}
			/>

			{error && !loading ? (
				<GlassCard className="p-6">
					<EmptyState
						icon={<TriangleAlert size={28} />}
						title="Couldn't load the overview"
						hint={error}
					/>
					<div className="flex justify-center pb-6">
						<Button variant="primary" onClick={reload}>
							<RefreshCw size={15} /> Retry
						</Button>
					</div>
				</GlassCard>
			) : (
				<div className="space-y-4">
					{data && (!data.kpis.ccConnected || !data.kpis.msConnected) && (
						<GlassCard className="flex flex-wrap items-center gap-3 p-4">
							<span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl glass-3d text-fg">
								<Plug size={17} />
							</span>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-fg">{missingProvidersMessage(data.kpis)}</p>
								<p className="text-xs text-muted">
									Connect integrations to push campaigns, publish webinars and sync engagement data.
								</p>
							</div>
							<Button variant="primary" size="sm" onClick={() => router.push("/connections")}>
								Open Connections
							</Button>
						</GlassCard>
					)}

					<KpiGrid kpis={kpis} loading={loading} count={6} />

					{/* engagement trend + lifetime funnel */}
					<div className="grid gap-4 lg:grid-cols-3">
						{loading || !data ? (
							<>
								<Skeleton className="h-[320px] lg:col-span-2" />
								<Skeleton className="h-[320px]" />
							</>
						) : (
							<>
								<ChartCard
									title="Engagement trend"
									subtitle="Opens vs clicks · last 30 days"
									className="lg:col-span-2"
								>
									{hasEngagement ? (
										<AreaTrend data={trend} labels={["Opens", "Clicks"]} height={260} />
									) : (
										<EmptyState
											icon={<Mail size={26} />}
											title="No engagement yet"
											hint="Send a campaign through Constant Contact — or run the database seed — and opens vs clicks will trend here."
										/>
									)}
								</ChartCard>
								<ChartCard title="Marketing funnel" subtitle="Lifetime · email to webinar">
									{funnel && funnel.sends > 0 ? (
										<FunnelBars data={funnelData} />
									) : (
										<EmptyState
											icon={<Funnel size={26} />}
											title="No sends yet"
											hint="Once a campaign goes out, the path from emails sent to webinar attendees will stack up here."
										/>
									)}
								</ChartCard>
							</>
						)}
					</div>

					{/* campaign performance · webinar show rate · personas */}
					<div className="grid gap-4 lg:grid-cols-3">
						{loading || !data ? (
							<>
								<Skeleton className="h-[300px]" />
								<Skeleton className="h-[300px]" />
								<Skeleton className="h-[300px]" />
							</>
						) : (
							<>
								<ChartCard title="Campaign performance" subtitle="Open rate % · last 6 sent">
									{campaignBars.length > 0 ? (
										<>
											<Bars data={campaignBars} height={180} />
											<ChartValueList rows={campaignRows} />
										</>
									) : (
										<EmptyState
											icon={<Mail size={26} />}
											title="No sent campaigns"
											hint="Open and click rates land here after your first campaign is sent."
										/>
									)}
								</ChartCard>
								<ChartCard title="Webinar show rate" subtitle="Attended as % of registered · last 5">
									{showRateBars.length > 0 ? (
										<>
											<Bars data={showRateBars} height={180} />
											<ChartValueList rows={showRateRows} />
										</>
									) : (
										<EmptyState
											icon={<Video size={26} />}
											title="No registrations yet"
											hint="Webinars with registrations will report attended vs registered here."
										/>
									)}
								</ChartCard>
								<ChartCard title="Contacts by persona" subtitle="Database split">
									{hasPersonaContacts ? (
										<BarList data={personaBars} />
									) : (
										<EmptyState
											icon={<Users size={26} />}
											title="No contacts yet"
											hint="Import or add contacts and their persona mix will show here."
										/>
									)}
								</ChartCard>
							</>
						)}
					</div>

					{/* top companies · needs attention · recent activity */}
					<div className="grid gap-4 lg:grid-cols-3">
						{loading || !data ? (
							<>
								<Skeleton className="h-64" />
								<Skeleton className="h-64" />
								<Skeleton className="h-64" />
							</>
						) : (
							<>
								<ChartCard title="Top companies" subtitle="By unique clicks">
									{topCompanies.length > 0 ? (
										<BarList data={topCompanies} />
									) : (
										<EmptyState
											icon={<Building2 size={26} />}
											title="No company engagement"
											hint="Once contacts start clicking campaigns, their companies will rank here."
										/>
									)}
								</ChartCard>
								<ChartCard title="Needs attention" subtitle="Drafts, schedules and data gaps">
									{attentionRows.length > 0 ? (
										<div className="-mx-2 space-y-0.5">{attentionRows}</div>
									) : (
										<div className="flex items-center gap-2.5 py-2 text-[13px] text-muted">
											<Dot tone="ok" /> All clear — nothing needs attention right now.
										</div>
									)}
								</ChartCard>
								<ChartCard title="Recent activity" subtitle="Latest changes across the workspace">
									{recentActivity.length > 0 ? (
										<ul className="space-y-2">
											{recentActivity.map((r) => (
												<li key={r.id} className="flex items-center gap-2 text-[13px] leading-5">
													<Badge tone={actionTone(r.action)} className="shrink-0">
														{r.action.replace(/[._]/g, " ")}
													</Badge>
													<span className="min-w-0 flex-1 truncate">
														<span className="text-fg">{r.entity}</span>
														<span className="text-muted"> · {r.userEmail ?? "System"}</span>
													</span>
													<span className="shrink-0 text-xs text-faint">{fromNow(r.createdAt)}</span>
												</li>
											))}
										</ul>
									) : (
										<EmptyState
											icon={<Activity size={26} />}
											title="No activity yet"
											hint="Changes made in the console are audited and surface here."
										/>
									)}
								</ChartCard>
							</>
						)}
					</div>

					{/* recent campaigns + upcoming webinars */}
					<div className="grid gap-4 lg:grid-cols-2">
						{loading || !data ? (
							<>
								<Skeleton className="h-64" />
								<Skeleton className="h-64" />
							</>
						) : (
							<>
								<ListCard title="Recent campaigns" subtitle="Latest five" href="/campaigns">
									{data.recentCampaigns.length > 0 ? (
										<RecentCampaignsTable campaigns={data.recentCampaigns} />
									) : (
										<EmptyState
											icon={<Mail size={26} />}
											title="No campaigns yet"
											hint="Create your first campaign — or run the database seed to load sample data."
										/>
									)}
								</ListCard>
								<ListCard title="Upcoming webinars" subtitle="Next five by start time" href="/webinars">
									{data.upcomingWebinars.length > 0 ? (
										<UpcomingWebinarsTable webinars={data.upcomingWebinars} />
									) : (
										<EmptyState
											icon={<Video size={26} />}
											title="No upcoming webinars"
											hint="Create a webinar and publish it to Teams — it will show up here."
										/>
									)}
								</ListCard>
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
}
