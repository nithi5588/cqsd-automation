"use client";

import { Building2, CircleCheck, Download, Globe, Info, Mail, Plug, RefreshCw, TriangleAlert, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusPill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useAsyncData } from "@/hooks/useApi";
import { connectionsApi, type OAuthProviderPath, oauthStartUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { fmtDateTime, fromNow, titleCase } from "@/lib/format";
import type { CcAccountInfo, CcImportJobStatus, ConnectionsStatus, ProviderConnectionStatus } from "@/types";

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

interface Banner {
	tone: "ok" | "danger";
	message: string;
}

/** Maps whatever provider slug the OAuth callback redirected with to a display name. */
function providerLabel(raw: string): string {
	const key = raw.toLowerCase().replace(/-/g, "_");
	if (key.includes("constant") || key === "cc") return "Constant Contact";
	if (key.includes("microsoft") || key.includes("teams") || key === "ms") return "Microsoft Teams";
	return titleCase(raw);
}

function DetailRow({
	label,
	value,
	warn,
	wrap,
}: {
	label: string;
	value: string;
	warn?: boolean;
	wrap?: boolean;
}) {
	return (
		<div className="flex items-start justify-between gap-4">
			<span className="shrink-0 pt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
				{label}
			</span>
			<span
				className={cn(
					"text-right text-sm",
					warn ? "font-medium text-[var(--warn)]" : "text-fg",
					wrap && "break-all text-xs text-muted",
				)}
			>
				{value}
			</span>
		</div>
	);
}

function ProviderCard({
	name,
	description,
	icon,
	status,
	provider,
	note,
	extraAction,
}: {
	name: string;
	description: string;
	icon: React.ReactNode;
	status: ProviderConnectionStatus;
	provider: OAuthProviderPath;
	note?: string;
	extraAction?: React.ReactNode;
}) {
	const expired = status.connected && new Date(status.expiresAt).getTime() <= Date.now();
	const pillStatus = status.connected ? (expired ? "expired" : "connected") : "not_connected";

	return (
		<GlassCard className="flex flex-col p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-3">
					<span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl glass-3d text-fg">
						{icon}
					</span>
					<div>
						<h2 className="text-base font-semibold tracking-tight text-emboss">{name}</h2>
						<p className="mt-0.5 text-xs text-muted">{description}</p>
					</div>
				</div>
				<StatusPill status={pillStatus} className="shrink-0" />
			</div>

			<div className="mt-4 flex-1 space-y-2.5">
				{status.connected ? (
					<>
						<DetailRow
							label="Token expiry"
							value={`${fromNow(status.expiresAt)} · ${fmtDateTime(status.expiresAt)}`}
							warn={expired}
						/>
						<DetailRow label="Last refreshed" value={fromNow(status.updatedAt)} />
						<DetailRow label="Scope" value={status.scope} wrap />
					</>
				) : (
					<p className="text-sm text-muted">
						Not connected yet. Authorize access to start syncing with {name}.
					</p>
				)}
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				<Button
					variant="primary"
					onClick={() => {
						window.location.href = oauthStartUrl(provider);
					}}
				>
					<Plug size={15} />
					{status.connected ? "Reconnect" : "Connect"}
				</Button>
				{extraAction}
			</div>

			{note && (
				<p className="mt-3 flex items-start gap-1.5 text-xs text-faint">
					<Info size={13} className="mt-0.5 shrink-0" />
					<span>{note}</span>
				</p>
			)}
		</GlassCard>
	);
}

/** Constant Contact's own account info (Account Services API) — shown once connected. */
function AccountInfoCard({ token }: { token: string | null }) {
	const { data, loading } = useAsyncData<{ account: CcAccountInfo }>(
		() => (token ? connectionsApi.constantContactAccountInfo(token) : new Promise(() => {})),
		[token],
	);

	if (loading || !data) {
		return <Skeleton className="h-16" />;
	}

	const { account } = data;
	const rows = [
		{ icon: <Building2 size={14} />, label: "Organization", value: account.organizationName },
		{ icon: <Mail size={14} />, label: "Account", value: account.accountName },
		{ icon: <Globe size={14} />, label: "Timezone / country", value: [account.timeZone, account.countryCode].filter(Boolean).join(" · ") },
	].filter((row) => row.value);

	if (rows.length === 0) return null;

	return (
		<GlassCard className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
			{rows.map((row) => (
				<span key={row.label} className="inline-flex items-center gap-2 text-[13px]">
					<span className="text-faint">{row.icon}</span>
					<span className="text-muted">{row.label}</span>
					<span className="font-medium text-fg">{row.value}</span>
				</span>
			))}
		</GlassCard>
	);
}

export default function ConnectionsPage() {
	const { token } = useAuth();
	const toast = useToast();
	const [banner, setBanner] = useState<Banner | null>(null);
	const [importing, setImporting] = useState(false);

	const { data, loading, error, reload } = useAsyncData<ConnectionsStatus>(
		() => (token ? connectionsApi.status(token) : new Promise<ConnectionsStatus>(() => {})),
		[token],
	);

	async function runImport() {
		if (!token || importing) return;
		setImporting(true);
		setBanner({
			tone: "ok",
			message: "Import started — a real account can take a few minutes to page through. This banner updates when it's done.",
		});
		try {
			const { jobId } = await connectionsApi.startImportConstantContact(token);

			// Poll every 2s for up to ~5 minutes — a large account can run well past
			// that, in which case the fallback message below tells the user to check
			// back later rather than leaving the tab polling indefinitely.
			const maxAttempts = 150;
			let status: CcImportJobStatus = { state: "waiting" };
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				status = await connectionsApi.importStatus(token, jobId);
				if (status.state === "completed" || status.state === "failed") break;
				if (status.progress && status.progress.total > 0) {
					setBanner({
						tone: "ok",
						message: `${status.progress.phase} — ${status.progress.completed.toLocaleString()} / ${status.progress.total.toLocaleString()}`,
					});
				} else if (status.progress?.phase) {
					setBanner({ tone: "ok", message: status.progress.phase });
				}
				await sleep(2000);
			}

			if (status.state === "completed" && status.result) {
				const { segments, contacts, campaigns } = status.result;
				const totalSegments = segments.listsImported + segments.dynamicSegmentsImported;
				toast(
					`Imported ${totalSegments} segments, ${contacts.created + contacts.updated} contacts and ${campaigns.created + campaigns.updated} campaigns from Constant Contact`,
					"ok",
				);
				setBanner({
					tone: "ok",
					message: `Constant Contact import complete — ${segments.listsImported} lists + ${segments.dynamicSegmentsImported} dynamic segments imported, ${contacts.created} new / ${contacts.updated} updated contacts, ${campaigns.created} new / ${campaigns.updated} updated campaigns.`,
				});
			} else if (status.state === "failed") {
				const message = status.error ?? "Import failed";
				toast(message, "warn");
				setBanner({ tone: "danger", message: `Constant Contact import failed: ${message}` });
			} else {
				setBanner({
					tone: "ok",
					message: "Still running in the background — refresh this page in a few minutes to see the result.",
				});
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : "Import failed";
			toast(message, "warn");
			setBanner({ tone: "danger", message: `Constant Contact import failed: ${message}` });
		} finally {
			setImporting(false);
		}
	}

	// The OAuth callback redirects back here with ?connected=<provider> or ?error=<message>.
	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		const connected = params.get("connected");
		const failed = params.get("error");
		if (!connected && !failed) return;

		if (connected) {
			const label = providerLabel(connected);
			setBanner({ tone: "ok", message: `${label} connected successfully.` });
			toast(`${label} connected`, "ok");
		} else if (failed) {
			setBanner({ tone: "danger", message: `Connection failed: ${failed}` });
		}
		// Strip the query params so the banner doesn't reappear on refresh.
		window.history.replaceState({}, "", window.location.pathname);
	}, [toast]);

	return (
		<>
			<PageHeader
				title="Connections"
				subtitle="OAuth links to Constant Contact and Microsoft Teams."
				actions={
					<Button variant="glass" size="sm" onClick={reload} disabled={loading}>
						<RefreshCw size={15} /> Refresh status
					</Button>
				}
			/>

			{banner && (
				<div
					className={cn(
						"mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
						banner.tone === "ok"
							? "border-[var(--ok)]/30 bg-[var(--ok)]/10 text-[var(--ok)]"
							: "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]",
					)}
				>
					{banner.tone === "ok" ? (
						<CircleCheck size={17} className="mt-0.5 shrink-0" />
					) : (
						<TriangleAlert size={17} className="mt-0.5 shrink-0" />
					)}
					<span className="flex-1">{banner.message}</span>
					<button
						type="button"
						onClick={() => setBanner(null)}
						aria-label="Dismiss"
						className="opacity-70 transition hover:opacity-100"
					>
						<X size={15} />
					</button>
				</div>
			)}

			{loading ? (
				<div className="grid gap-4 lg:grid-cols-2">
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
				</div>
			) : error ? (
				<GlassCard className="p-6">
					<EmptyState
						icon={<TriangleAlert size={28} />}
						title="Couldn't load connection status"
						hint={error}
					/>
					<div className="flex justify-center pb-6">
						<Button variant="primary" onClick={reload}>
							<RefreshCw size={15} /> Retry
						</Button>
					</div>
				</GlassCard>
			) : data ? (
				<div className="space-y-4">
					{data.constantContact.connected && <AccountInfoCard token={token} />}
					<div className="grid gap-4 lg:grid-cols-2">
						<ProviderCard
							name="Constant Contact"
							description="Email campaigns, contact lists and engagement tracking."
							icon={<Mail size={19} />}
							status={data.constantContact}
							provider="constant-contact"
							note={
								data.constantContact.connected
									? "Import pulls every list, dynamic segment, tag, custom field, contact and campaign already in this account — safe to re-run, nothing duplicates."
									: undefined
							}
							extraAction={
								data.constantContact.connected ? (
									<Button variant="glass" onClick={runImport} disabled={importing}>
										{importing ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
										{importing ? "Importing…" : "Import my Constant Contact data"}
									</Button>
								) : undefined
							}
						/>
						<ProviderCard
							name="Microsoft Teams"
							description="Teams webinars, registrations and attendance reports."
							icon={<Video size={19} />}
							status={data.microsoft}
							provider="microsoft"
							note="Publishing webinars and pulling attendance require tenant admin consent plus an Application Access Policy for the organizer account."
						/>
					</div>
				</div>
			) : null}
		</>
	);
}
