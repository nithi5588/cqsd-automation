"use client";

import {
	ArrowRight,
	CalendarDays,
	Check,
	CircleCheck,
	Clock,
	Copy,
	TriangleAlert,
	VideoOff,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { ApiError, webinarsApi } from "@/lib/api";
import type { PublicWebinarInfo } from "@/lib/api/webinars";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
	name?: string;
	email?: string;
	company?: string;
}

function validate(name: string, email: string, company: string): FieldErrors {
	const errors: FieldErrors = {};
	if (!name.trim()) errors.name = "Please enter your name";
	else if (name.trim().length > 200) errors.name = "Name must be 200 characters or fewer";
	if (!email.trim()) errors.email = "Please enter your email";
	else if (!EMAIL_RE.test(email.trim())) errors.email = "Please enter a valid email address";
	if (company.trim().length > 200) errors.company = "Company must be 200 characters or fewer";
	return errors;
}

/**
 * Formats the webinar window in the webinar's own time zone (with a short zone
 * label). Falls back to the viewer's local time — annotated with the raw zone
 * id — when the backend stores a zone Intl doesn't recognize.
 */
function formatSchedule(startsAt: string, endsAt: string, timeZone: string): { date: string; time: string } {
	const start = new Date(startsAt);
	const end = new Date(endsAt);
	const dateOptions: Intl.DateTimeFormatOptions = {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	};
	const timeOptions: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
	try {
		const date = new Intl.DateTimeFormat("en-US", { ...dateOptions, timeZone }).format(start);
		const timeFmt = new Intl.DateTimeFormat("en-US", { ...timeOptions, timeZone });
		const zone =
			new Intl.DateTimeFormat("en-US", { hour: "numeric", timeZone, timeZoneName: "short" })
				.formatToParts(start)
				.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
		return { date, time: `${timeFmt.format(start)} – ${timeFmt.format(end)} ${zone}` };
	} catch {
		const timeFmt = new Intl.DateTimeFormat("en-US", timeOptions);
		return {
			date: new Intl.DateTimeFormat("en-US", dateOptions).format(start),
			time: `${timeFmt.format(start)} – ${timeFmt.format(end)} (${timeZone})`,
		};
	}
}

function Logo() {
	return (
		// Plain <img>: a small static asset from /public, no next/image sizing needed.
		// White chip in dark mode so the wordmark stays legible; bare in light.
		<span className="mx-auto inline-flex items-center rounded-md dark:bg-white dark:px-2 dark:py-1 dark:ring-1 dark:ring-black/10">
			<img src="/logo.png" alt="CompQsoft" className="h-9 w-auto object-contain" />
		</span>
	);
}

export default function PublicRegisterPage() {
	const { slug } = useParams<{ slug: string }>();

	// webinar info
	const [info, setInfo] = useState<PublicWebinarInfo | null>(null);
	const [loading, setLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [reloadTick, setReloadTick] = useState(0);

	// form
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [company, setCompany] = useState("");
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	// success
	const [registered, setRegistered] = useState(false);
	const [joinUrl, setJoinUrl] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	// Client component, so no static `metadata` export — set the tab title by hand.
	useEffect(() => {
		if (info) document.title = `Register · ${info.title}`;
	}, [info]);

	useEffect(() => {
		if (!slug) return;
		let cancelled = false;
		setLoading(true);
		setNotFound(false);
		setLoadError(null);

		webinarsApi
			.publicInfo(slug)
			.then(({ webinar }) => {
				if (!cancelled) setInfo(webinar);
			})
			.catch((err) => {
				if (cancelled) return;
				if (err instanceof ApiError && err.status === 404) setNotFound(true);
				else setLoadError(err instanceof ApiError ? err.message : "Something went wrong");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [slug, reloadTick]);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		const errors = validate(name, email, company);
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;

		setSubmitError(null);
		setSubmitting(true);
		try {
			const result = await webinarsApi.register(null, slug, {
				name: name.trim(),
				email: email.trim(),
				company: company.trim() || undefined,
			});
			setJoinUrl(result.joinUrl);
			setRegistered(true);
		} catch (err) {
			// Registration can close between page load and submit — treat that 404
			// the same as a dead link instead of showing a confusing form error.
			if (err instanceof ApiError && err.status === 404) setNotFound(true);
			else setSubmitError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	function copyJoinLink() {
		if (!joinUrl) return;
		navigator.clipboard
			.writeText(joinUrl)
			.then(() => {
				setCopied(true);
				window.setTimeout(() => setCopied(false), 2000);
			})
			.catch(() => setCopied(false));
	}

	const schedule = info ? formatSchedule(info.startsAt, info.endsAt, info.timeZone) : null;

	let content: React.ReactNode;
	if (loading) {
		content = (
			<div className="p-8">
				<Skeleton className="mx-auto h-10 w-32" />
				<Skeleton className="mx-auto mt-6 h-6 w-3/4" />
				<Skeleton className="mx-auto mt-3 h-4 w-1/2" />
				<div className="mt-8 space-y-4">
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-9 w-full" />
					<Skeleton className="h-10 w-full" />
				</div>
			</div>
		);
	} else if (notFound) {
		content = (
			<div className="p-8 text-center">
				<Logo />
				<EmptyState
					icon={<VideoOff size={20} />}
					title="Registration closed or webinar not found"
					hint="This registration link is no longer active. Double-check the URL or contact the organizer for a new invitation."
				/>
			</div>
		);
	} else if (loadError || !info || !schedule) {
		content = (
			<div className="p-8 text-center">
				<Logo />
				<EmptyState
					icon={<TriangleAlert size={20} />}
					title="Couldn't load this webinar"
					hint={loadError ?? "Something went wrong"}
				/>
				<div className="flex justify-center pb-2">
					<Button onClick={() => setReloadTick((t) => t + 1)}>Retry</Button>
				</div>
			</div>
		);
	} else if (registered) {
		content = (
			<div className="p-8 text-center">
				<Logo />
				<span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ok-soft)]">
					<CircleCheck size={32} className="text-[var(--ok)]" aria-hidden />
				</span>
				<h1 className="mt-4 text-xl font-extrabold tracking-tight text-fg">You&apos;re registered</h1>
				<p className="mt-2 text-[13px] text-muted">
					{info.title} · {schedule.date}, {schedule.time}
				</p>
				{joinUrl ? (
					<div className="mt-6 space-y-3">
						<Button variant="glass" size="md" className="w-full" onClick={copyJoinLink}>
							{copied ? (
								<>
									<Check size={16} /> Copied
								</>
							) : (
								<>
									<Copy size={16} /> Copy join link
								</>
							)}
						</Button>
						<p className="text-xs text-muted">You&apos;ll also receive the join link by email.</p>
					</div>
				) : (
					<p className="mt-6 text-[13px] text-muted">
						Your join link will arrive by email before the webinar starts.
					</p>
				)}
			</div>
		);
	} else {
		content = (
			<>
				<div className="border-b border-hairline p-8 pb-6 text-center">
					<Logo />
					<span className="mx-auto mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-brand">
						<span className="h-1.5 w-1.5 rounded-full bg-brand" /> Live webinar
					</span>
					<h1 className="mt-3 text-xl font-extrabold leading-tight tracking-tight text-fg">{info.title}</h1>
					<div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[13px] text-muted">
						<span className="inline-flex items-center gap-1.5">
							<CalendarDays size={15} /> {schedule.date}
						</span>
						<span className="inline-flex items-center gap-1.5">
							<Clock size={15} /> {schedule.time}
						</span>
					</div>
					{info.description && (
						<p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-muted">{info.description}</p>
					)}
				</div>

				<form onSubmit={submit} noValidate className="space-y-4 p-8 pt-6">
					<div>
						<Label htmlFor="name">Full name</Label>
						<Input
							id="name"
							autoComplete="name"
							placeholder="Jane Smith"
							value={name}
							onChange={(e) => setName(e.target.value)}
							aria-invalid={Boolean(fieldErrors.name)}
						/>
						{fieldErrors.name && <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.name}</p>}
					</div>
					<div>
						<Label htmlFor="email">Work email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							placeholder="jane@company.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							aria-invalid={Boolean(fieldErrors.email)}
						/>
						{fieldErrors.email && <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.email}</p>}
					</div>
					<div>
						<Label htmlFor="company">
							Company <span className="font-normal text-faint">(optional)</span>
						</Label>
						<Input
							id="company"
							autoComplete="organization"
							placeholder="Acme Corp"
							value={company}
							onChange={(e) => setCompany(e.target.value)}
							aria-invalid={Boolean(fieldErrors.company)}
						/>
						{fieldErrors.company && <p className="mt-1 text-xs text-[var(--danger)]">{fieldErrors.company}</p>}
					</div>
					{submitError && (
						<p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-[13px] text-[var(--danger)]">
							{submitError}
						</p>
					)}
					<Button type="submit" variant="primary" size="md" className="w-full" disabled={submitting}>
						{submitting ? (
							<Spinner />
						) : (
							<>
								Register <ArrowRight size={16} />
							</>
						)}
					</Button>
					<p className="text-center text-xs text-faint">
						We&apos;ll only use your details to send you updates about this webinar.
					</p>
				</form>
			</>
		);
	}

	return (
		<div className="relative grid min-h-screen place-items-center bg-bg p-4">
			<div className="absolute right-4 top-4">
				<ThemeToggle />
			</div>

			<main className="w-full max-w-xl">
				<div className="overflow-hidden rounded-2xl border border-hairline bg-[var(--glass-strong)] shadow-[var(--shadow-overlay)]">
					<div aria-hidden className="brand-gradient-bg h-1.5 w-full" />
					{content}
				</div>
				<p className="mt-4 text-center text-xs text-faint">CompQsoft Digital · Marketing Automation</p>
			</main>
		</div>
	);
}
