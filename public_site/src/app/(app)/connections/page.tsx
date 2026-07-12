"use client";

import { CircleCheck, Info, Mail, Plug, RefreshCw, TriangleAlert, Video, X } from "lucide-react";
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
import type { ConnectionsStatus, ProviderConnectionStatus } from "@/types";

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
}: {
	name: string;
	description: string;
	icon: React.ReactNode;
	status: ProviderConnectionStatus;
	provider: OAuthProviderPath;
	note?: string;
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

			<div className="mt-4">
				<Button
					variant="primary"
					onClick={() => {
						window.location.href = oauthStartUrl(provider);
					}}
				>
					<Plug size={15} />
					{status.connected ? "Reconnect" : "Connect"}
				</Button>
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

export default function ConnectionsPage() {
	const { token } = useAuth();
	const toast = useToast();
	const [banner, setBanner] = useState<Banner | null>(null);

	const { data, loading, error, reload } = useAsyncData<ConnectionsStatus>(
		() => (token ? connectionsApi.status(token) : new Promise<ConnectionsStatus>(() => {})),
		[token],
	);

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
				<div className="grid gap-4 lg:grid-cols-2">
					<ProviderCard
						name="Constant Contact"
						description="Email campaigns, contact lists and engagement tracking."
						icon={<Mail size={19} />}
						status={data.constantContact}
						provider="constant-contact"
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
			) : null}
		</>
	);
}
