"use client";

import { ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { FilterSelect, MultiSelectFilter } from "@/components/ui/filters";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal, Sheet } from "@/components/ui/modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { useAsyncData } from "@/hooks/useApi";
import { ApiError, contactsApi } from "@/lib/api";
import { dur, fmtDate, fmtDateTime, num } from "@/lib/format";
import type {
	ContactCreateInput,
	ContactDetail,
	ContactImportRow,
	ContactListItem,
	Persona,
} from "@/types/domain";

const PAGE_SIZE = 25;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONA_LABEL: Record<Persona, string> = {
	IT: "IT",
	LINE_OF_BUSINESS: "Line of Business",
	CUSTOMER_SERVICE: "Customer Service",
};

const PERSONA_OPTIONS = (Object.keys(PERSONA_LABEL) as Persona[]).map((value) => ({
	value,
	label: PERSONA_LABEL[value],
}));

const SOURCE_LABEL: Record<string, string> = {
	MANUAL: "Manual",
	CSV_IMPORT: "CSV Import",
	CSV: "CSV",
	LEADGEN: "LeadGen",
	WEBSITE: "Website",
	TEAMS: "Teams",
	CONSTANT_CONTACT: "Constant Contact",
};

const BASE_INDUSTRIES = ["Finance", "Healthcare", "Logistics", "Manufacturing", "Retail", "Technology"];

// ============================================================
// CSV parsing (client-side, quote-aware)
// ============================================================

function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let inQuotes = false;
	const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (inQuotes) {
			if (ch === '"') {
				if (src[i + 1] === '"') {
					cell += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				cell += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === ",") {
			row.push(cell);
			cell = "";
		} else if (ch === "\n" || ch === "\r") {
			if (ch === "\r" && src[i + 1] === "\n") i++;
			row.push(cell);
			cell = "";
			rows.push(row);
			row = [];
		} else {
			cell += ch;
		}
	}
	if (cell.length > 0 || row.length > 0) {
		row.push(cell);
		rows.push(row);
	}
	return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_ALIASES: Record<string, keyof ContactImportRow> = {
	firstname: "firstName",
	first: "firstName",
	givenname: "firstName",
	lastname: "lastName",
	last: "lastName",
	surname: "lastName",
	email: "email",
	emailaddress: "email",
	title: "title",
	jobtitle: "title",
	industry: "industry",
	persona: "persona",
	orgname: "orgName",
	org: "orgName",
	organization: "orgName",
	organizationname: "orgName",
	company: "orgName",
	companyname: "orgName",
	aeowner: "aeOwner",
	ae: "aeOwner",
	accountexecutive: "aeOwner",
};

function normalizePersona(value: string): Persona | undefined {
	const s = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
	if (s === "IT") return "IT";
	if (s === "LINE_OF_BUSINESS" || s === "LOB" || s === "BUSINESS") return "LINE_OF_BUSINESS";
	if (s === "CUSTOMER_SERVICE" || s === "CS") return "CUSTOMER_SERVICE";
	return undefined;
}

interface ParsedImport {
	rows: ContactImportRow[];
	skipped: Array<{ line: number; reason: string }>;
	headerError: string | null;
}

function buildImportRows(text: string): ParsedImport {
	const table = parseCsv(text);
	if (table.length < 2) {
		return { rows: [], skipped: [], headerError: "Paste a header row plus at least one data row." };
	}
	const headerCells = table[0] ?? [];
	const header = headerCells.map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[\s_-]+/g, "")]);
	if (!header.includes("email") || !header.includes("firstName") || !header.includes("lastName")) {
		return {
			rows: [],
			skipped: [],
			headerError: "The header row must include firstName, lastName and email columns.",
		};
	}
	const rows: ContactImportRow[] = [];
	const skipped: Array<{ line: number; reason: string }> = [];
	const seen = new Set<string>();
	for (let i = 1; i < table.length; i++) {
		const line = i + 1;
		const raw: Partial<Record<keyof ContactImportRow, string>> = {};
		(table[i] ?? []).forEach((cellValue, idx) => {
			const key = header[idx];
			if (key) raw[key] = cellValue.trim();
		});
		const email = (raw.email ?? "").toLowerCase();
		if (!EMAIL_RE.test(email)) {
			skipped.push({ line, reason: `invalid email "${raw.email ?? ""}"` });
			continue;
		}
		if (!raw.firstName || !raw.lastName) {
			skipped.push({ line, reason: "missing first or last name" });
			continue;
		}
		if (seen.has(email)) {
			skipped.push({ line, reason: `duplicate of ${email}` });
			continue;
		}
		seen.add(email);
		rows.push({
			firstName: raw.firstName,
			lastName: raw.lastName,
			email,
			title: raw.title || undefined,
			industry: raw.industry || undefined,
			persona: raw.persona ? normalizePersona(raw.persona) : undefined,
			orgName: raw.orgName || undefined,
			aeOwner: raw.aeOwner || undefined,
		});
	}
	return { rows, skipped, headerError: null };
}

// ============================================================
// Small page-local pieces
// ============================================================

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-3 py-1.5">
			<span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
			<span className="min-w-0 text-right text-sm text-fg">{children}</span>
		</div>
	);
}

function ConfirmDialog({
	open,
	title,
	message,
	busy,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	title: string;
	message: string;
	busy: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}) {
	return (
		<Modal
			open={open}
			onClose={() => !busy && onCancel()}
			title={title}
			size="sm"
			footer={
				<>
					<Button variant="ghost" onClick={onCancel} disabled={busy}>
						Cancel
					</Button>
					<Button variant="danger" onClick={onConfirm} disabled={busy}>
						{busy && <Spinner />}
						Delete
					</Button>
				</>
			}
		>
			<p className="text-sm text-muted">{message}</p>
		</Modal>
	);
}

interface ContactFormState {
	firstName: string;
	lastName: string;
	email: string;
	title: string;
	industry: string;
	persona: string;
	orgName: string;
}

const EMPTY_FORM: ContactFormState = {
	firstName: "",
	lastName: "",
	email: "",
	title: "",
	industry: "",
	persona: "",
	orgName: "",
};

// ============================================================
// Page
// ============================================================

export default function ContactsPage() {
	const { token } = useAuth();
	const toast = useToast();

	// ---- list filters (server-side) ----
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [persona, setPersona] = useState("");
	const [industry, setIndustry] = useState("");
	const [tags, setTags] = useState<string[]>([]);
	const [page, setPage] = useState(1);

	useEffect(() => {
		const t = setTimeout(() => {
			setSearch(searchInput.trim());
			setPage(1);
		}, 300);
		return () => clearTimeout(t);
	}, [searchInput]);

	const tagOptions = useAsyncData(() => contactsApi.listTags(token), [token]);

	const list = useAsyncData(
		() =>
			contactsApi.list(token, {
				search: search || undefined,
				persona: (persona || undefined) as Persona | undefined,
				industry: industry || undefined,
				tags: tags.length > 0 ? tags.join(",") : undefined,
				page,
				pageSize: PAGE_SIZE,
			}),
		[token, search, persona, industry, tags, page],
	);

	// ---- detail sheet ----
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const detail = useAsyncData<{ contact: ContactDetail } | null>(
		() => (selectedId ? contactsApi.get(token, selectedId) : Promise.resolve(null)),
		[token, selectedId],
	);
	const contact = selectedId ? (detail.data?.contact ?? null) : null;

	// ---- add / edit modal ----
	const [formOpen, setFormOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [form, setForm] = useState<ContactFormState>(EMPTY_FORM);
	const [saving, setSaving] = useState(false);

	const setField = (key: keyof ContactFormState, value: string) => setForm((f) => ({ ...f, [key]: value }));

	const openCreate = () => {
		setEditingId(null);
		setForm(EMPTY_FORM);
		setFormOpen(true);
	};

	const openEdit = (c: ContactDetail) => {
		setEditingId(c.id);
		setForm({
			firstName: c.firstName,
			lastName: c.lastName,
			email: c.email,
			title: c.title ?? "",
			industry: c.industry ?? "",
			persona: c.persona ?? "",
			orgName: c.organization?.name ?? "",
		});
		setFormOpen(true);
	};

	const submitForm = async () => {
		if (!form.firstName.trim() || !form.lastName.trim() || !EMAIL_RE.test(form.email.trim())) {
			toast("First name, last name and a valid email are required.", "warn");
			return;
		}
		setSaving(true);
		try {
			const payload: ContactCreateInput = {
				firstName: form.firstName.trim(),
				lastName: form.lastName.trim(),
				email: form.email.trim().toLowerCase(),
				title: form.title.trim() || undefined,
				industry: form.industry.trim() || undefined,
				persona: (form.persona || undefined) as Persona | undefined,
				orgName: form.orgName.trim() || undefined,
			};
			if (editingId) {
				await contactsApi.update(token, editingId, payload);
				toast("Contact updated");
			} else {
				await contactsApi.create(token, payload);
				toast("Contact created");
			}
			setFormOpen(false);
			list.reload();
			if (editingId && selectedId === editingId) detail.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setSaving(false);
		}
	};

	// ---- delete ----
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	const deleteContact = async () => {
		if (!selectedId) return;
		setDeleting(true);
		try {
			await contactsApi.remove(token, selectedId);
			toast("Contact deleted");
			setConfirmDelete(false);
			setSelectedId(null);
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setDeleting(false);
		}
	};

	// ---- CSV import ----
	const [importOpen, setImportOpen] = useState(false);
	const [csvText, setCsvText] = useState("");
	const [fileName, setFileName] = useState<string | null>(null);
	const [importing, setImporting] = useState(false);

	const parsed = useMemo(() => (csvText.trim() ? buildImportRows(csvText) : null), [csvText]);

	const closeImport = () => {
		setImportOpen(false);
		setCsvText("");
		setFileName(null);
	};

	const runImport = async () => {
		if (!parsed || parsed.headerError || parsed.rows.length === 0) {
			toast("No valid rows to import.", "warn");
			return;
		}
		setImporting(true);
		try {
			const result = await contactsApi.importContacts(token, {
				source: "CSV",
				rows: parsed.rows.slice(0, 5000),
			});
			toast(
				`Import complete — ${num(result.created)} created, ${num(result.updated)} updated, ${num(result.skipped.length)} skipped.`,
			);
			closeImport();
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setImporting(false);
		}
	};

	// ---- table ----
	const columns = useMemo<ColumnDef<ContactListItem>[]>(
		() => [
			{
				id: "name",
				header: "Name",
				accessorFn: (r) => `${r.firstName} ${r.lastName}`,
				cell: ({ row }) => (
					<span className="font-medium text-fg">
						{row.original.firstName} {row.original.lastName}
					</span>
				),
			},
			{
				id: "email",
				header: "Email",
				accessorFn: (r) => r.email,
				cell: ({ row }) => <span className="text-muted">{row.original.email}</span>,
			},
			{
				id: "title",
				header: "Title",
				accessorFn: (r) => r.title ?? "",
				cell: ({ row }) => row.original.title ?? <span className="text-faint">—</span>,
			},
			{
				id: "company",
				header: "Company",
				accessorFn: (r) => r.organization?.name ?? "",
				cell: ({ row }) => row.original.organization?.name ?? <span className="text-faint">—</span>,
			},
			{
				id: "persona",
				header: "Persona",
				accessorFn: (r) => r.persona ?? "",
				cell: ({ row }) =>
					row.original.persona ? (
						<Badge tone="info">{PERSONA_LABEL[row.original.persona]}</Badge>
					) : (
						<span className="text-faint">—</span>
					),
			},
			{
				id: "source",
				header: "Source",
				accessorFn: (r) => r.source,
				cell: ({ row }) => <Badge>{SOURCE_LABEL[row.original.source] ?? row.original.source}</Badge>,
			},
			{
				id: "ccSynced",
				header: "CC",
				accessorFn: (r) => (r.bounced ? -1 : r.ccSynced ? 1 : 0),
				cell: ({ row }) =>
					row.original.bounced ? (
						<Badge tone="danger">Bounced</Badge>
					) : (
						<span
							className="inline-flex"
							title={row.original.ccSynced ? "Synced to Constant Contact" : "Not synced to Constant Contact"}
						>
							<Dot tone={row.original.ccSynced ? "ok" : "neutral"} />
						</span>
					),
			},
			{
				id: "created",
				header: "Created",
				accessorFn: (r) => r.createdAt,
				cell: ({ row }) => <span className="text-muted">{fmtDate(row.original.createdAt)}</span>,
			},
		],
		[],
	);

	const items = list.data?.items ?? [];
	const total = list.data?.total ?? 0;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	const industryOptions = useMemo(() => {
		const set = new Set<string>(BASE_INDUSTRIES);
		for (const c of items) if (c.industry) set.add(c.industry);
		if (industry) set.add(industry);
		return [...set].sort().map((v) => ({ value: v, label: v }));
	}, [items, industry]);

	const toolbar = (
		<>
			<div className="glass-inset flex h-9 items-center gap-2 rounded-xl px-3">
				<Search size={15} className="text-faint" />
				<input
					value={searchInput}
					onChange={(e) => setSearchInput(e.target.value)}
					placeholder="Search name or email…"
					className="w-40 bg-transparent text-sm outline-none placeholder:text-faint sm:w-56"
				/>
			</div>
			<FilterSelect
				label="Persona"
				value={persona}
				onChange={(v) => {
					setPersona(v);
					setPage(1);
				}}
				options={PERSONA_OPTIONS}
			/>
			<FilterSelect
				label="Industry"
				value={industry}
				onChange={(v) => {
					setIndustry(v);
					setPage(1);
				}}
				options={industryOptions}
			/>
			{(tagOptions.data?.tags.length ?? 0) > 0 && (
				<MultiSelectFilter
					label="Tags"
					options={tagOptions.data?.tags ?? []}
					selected={tags}
					onApply={(values) => {
						setTags(values);
						setPage(1);
					}}
				/>
			)}
		</>
	);

	return (
		<>
			<PageHeader
				title="Contacts"
				subtitle={list.data ? `${num(total)} contacts in your database` : "Your marketing contact database"}
				actions={
					<>
						<Button variant="glass" onClick={() => setImportOpen(true)}>
							<Upload size={16} /> Import CSV
						</Button>
						<Button variant="primary" onClick={openCreate}>
							<Plus size={16} /> Add contact
						</Button>
					</>
				}
			/>

			{list.error ? (
				<GlassCard>
					<EmptyState title="Couldn't load contacts" hint={list.error} />
					<div className="flex justify-center pb-8">
						<Button variant="glass" onClick={list.reload}>
							<RefreshCw size={15} /> Retry
						</Button>
					</div>
				</GlassCard>
			) : list.loading && !list.data ? (
				<div className="space-y-3">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-96 w-full" />
				</div>
			) : (
				<>
					<DataTable
						data={items}
						columns={columns}
						toolbar={toolbar}
						searchPlaceholder="Filter this page…"
						pageSize={PAGE_SIZE}
						onRowClick={(row) => setSelectedId(row.id)}
					/>
					{pageCount > 1 && (
						<div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted">
							<span className="tnum">
								Page {page} of {pageCount} · {num(total)} contacts
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

			{/* ---- detail sheet ---- */}
			<Sheet
				open={selectedId !== null}
				onClose={() => setSelectedId(null)}
				title={contact ? `${contact.firstName} ${contact.lastName}` : "Contact"}
				subtitle={contact?.email}
				width={560}
			>
				{detail.loading ? (
					<div className="space-y-3">
						<Skeleton className="h-40 w-full" />
						<Skeleton className="h-32 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				) : detail.error ? (
					<>
						<EmptyState title="Couldn't load contact" hint={detail.error} />
						<div className="flex justify-center">
							<Button variant="glass" onClick={detail.reload}>
								<RefreshCw size={15} /> Retry
							</Button>
						</div>
					</>
				) : contact ? (
					<div className="space-y-5">
						<div className="flex flex-wrap items-center gap-2">
							<Button variant="glass" size="sm" onClick={() => openEdit(contact)}>
								<Pencil size={14} /> Edit
							</Button>
							<Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
								<Trash2 size={14} /> Delete
							</Button>
						</div>

						<GlassCard className="divide-y divide-hairline px-4 py-2">
							<DetailRow label="Title">{contact.title ?? "—"}</DetailRow>
							<DetailRow label="Company">{contact.organization?.name ?? "—"}</DetailRow>
							<DetailRow label="Persona">
								{contact.persona ? <Badge tone="info">{PERSONA_LABEL[contact.persona]}</Badge> : "—"}
							</DetailRow>
							<DetailRow label="Industry">{contact.industry ?? "—"}</DetailRow>
							<DetailRow label="Source">
								<Badge>{SOURCE_LABEL[contact.source] ?? contact.source}</Badge>
							</DetailRow>
							<DetailRow label="Constant Contact">
								<span className="inline-flex items-center gap-1.5">
									<Dot tone={contact.ccSynced ? "ok" : "neutral"} />
									{contact.ccSynced ? "Synced" : "Not synced"}
								</span>
							</DetailRow>
							<DetailRow label="Created">{fmtDate(contact.createdAt)}</DetailRow>
						</GlassCard>

						{contact.tags.length > 0 && (
							<section>
								<h3 className="mb-2 text-sm font-semibold text-emboss">Constant Contact tags</h3>
								<div className="flex flex-wrap gap-1.5">
									{contact.tags.map((tag) => (
										<span
											key={tag}
											className="inline-flex items-center rounded-full border border-hairline bg-[var(--accent-soft)] px-2.5 py-1 text-[12px] font-medium text-brand"
										>
											{tag}
										</span>
									))}
								</div>
							</section>
						)}

						{contact.customFields && Object.keys(contact.customFields).length > 0 && (
							<section>
								<h3 className="mb-2 text-sm font-semibold text-emboss">Custom fields</h3>
								<GlassCard className="divide-y divide-hairline px-4 py-2">
									{Object.entries(contact.customFields).map(([label, value]) => (
										<DetailRow key={label} label={label}>
											{value || "—"}
										</DetailRow>
									))}
								</GlassCard>
							</section>
						)}

						<section>
							<h3 className="mb-2 text-sm font-semibold text-emboss">Campaign activity</h3>
							<p className="mb-2 text-xs text-muted">
								{num(contact.activity.campaignsSent)} campaigns · {num(contact.activity.opens)} opens ·{" "}
								{num(contact.activity.clicks)} clicks
							</p>
							{contact.activity.rows.length === 0 ? (
								<p className="text-sm text-faint">No campaign activity yet.</p>
							) : (
								<div className="overflow-x-auto rounded-xl glass">
									<table className="w-full min-w-[480px] border-collapse text-sm">
										<thead>
											<tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
												<th className="px-3 py-2">Campaign</th>
												<th className="px-3 py-2">Opened</th>
												<th className="px-3 py-2">Clicked</th>
												<th className="px-3 py-2">Opens</th>
												<th className="px-3 py-2">Clicks</th>
												<th className="px-3 py-2">First open</th>
												<th className="px-3 py-2">First click</th>
											</tr>
										</thead>
										<tbody>
											{contact.activity.rows.map((r) => (
												<tr key={r.campaignId} className="border-b border-hairline/60 last:border-0">
													<td className="px-3 py-2">
														<span className="font-medium text-fg">{r.campaignName}</span>
														<span className="block max-w-52 truncate text-xs text-muted">{r.subject}</span>
													</td>
													<td className="px-3 py-2">
														<Dot tone={r.opened ? "ok" : "neutral"} />
													</td>
													<td className="px-3 py-2">
														<Dot tone={r.clicked ? "ok" : "neutral"} />
													</td>
													<td className="tnum px-3 py-2">{num(r.openCount)}</td>
													<td className="tnum px-3 py-2">{num(r.clickCount)}</td>
													<td className="px-3 py-2 text-muted">
														{r.firstOpenAt ? fmtDateTime(r.firstOpenAt) : "—"}
													</td>
													<td className="px-3 py-2 text-muted">
														{r.firstClickAt ? fmtDateTime(r.firstClickAt) : "—"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</section>

						<section>
							<h3 className="mb-2 text-sm font-semibold text-emboss">Webinar registrations</h3>
							{contact.registrations.length === 0 ? (
								<p className="text-sm text-faint">No registrations yet.</p>
							) : (
								<ul className="space-y-1.5">
									{contact.registrations.map((r) => (
										<li
											key={`${r.webinarId}-${r.registeredAt}`}
											className="flex items-center justify-between gap-3 rounded-xl glass px-3 py-2 text-sm"
										>
											<span className="font-medium text-fg">{r.webinarTitle}</span>
											<span className="shrink-0 text-xs text-muted">{fmtDateTime(r.registeredAt)}</span>
										</li>
									))}
								</ul>
							)}
						</section>

						<section>
							<h3 className="mb-2 text-sm font-semibold text-emboss">Webinar attendance</h3>
							{contact.attendance.length === 0 ? (
								<p className="text-sm text-faint">No attendance yet.</p>
							) : (
								<ul className="space-y-1.5">
									{contact.attendance.map((a) => (
										<li
											key={`${a.webinarId}-${a.joinTime ?? "na"}`}
											className="flex items-center justify-between gap-3 rounded-xl glass px-3 py-2 text-sm"
										>
											<span className="min-w-0">
												<span className="block truncate font-medium text-fg">{a.webinarTitle}</span>
												{a.joinTime && (
													<span className="block text-xs text-muted">Joined {fmtDateTime(a.joinTime)}</span>
												)}
											</span>
											<Badge tone="ok" className="shrink-0">
												{dur(a.durationSeconds)}
											</Badge>
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
				) : null}
			</Sheet>

			{/* ---- add / edit modal ---- */}
			<Modal
				open={formOpen}
				onClose={() => !saving && setFormOpen(false)}
				title={editingId ? "Edit contact" : "Add contact"}
				subtitle={editingId ? undefined : "Create a single contact — use Import CSV for bulk."}
				footer={
					<>
						<Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submitForm} disabled={saving}>
							{saving && <Spinner />}
							{editingId ? "Save changes" : "Create contact"}
						</Button>
					</>
				}
			>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<Label htmlFor="contact-first-name">First name</Label>
						<Input
							id="contact-first-name"
							value={form.firstName}
							onChange={(e) => setField("firstName", e.target.value)}
							placeholder="Jane"
						/>
					</div>
					<div>
						<Label htmlFor="contact-last-name">Last name</Label>
						<Input
							id="contact-last-name"
							value={form.lastName}
							onChange={(e) => setField("lastName", e.target.value)}
							placeholder="Doe"
						/>
					</div>
					<div className="sm:col-span-2">
						<Label htmlFor="contact-email">Email</Label>
						<Input
							id="contact-email"
							type="email"
							value={form.email}
							onChange={(e) => setField("email", e.target.value)}
							placeholder="jane.doe@acme.com"
						/>
					</div>
					<div>
						<Label htmlFor="contact-title">Title</Label>
						<Input
							id="contact-title"
							value={form.title}
							onChange={(e) => setField("title", e.target.value)}
							placeholder="VP of Operations"
						/>
					</div>
					<div>
						<Label htmlFor="contact-persona">Persona</Label>
						<Select
							id="contact-persona"
							value={form.persona}
							onChange={(e) => setField("persona", e.target.value)}
						>
							<option value="">None</option>
							{PERSONA_OPTIONS.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</Select>
					</div>
					<div>
						<Label htmlFor="contact-industry">Industry</Label>
						<Input
							id="contact-industry"
							value={form.industry}
							onChange={(e) => setField("industry", e.target.value)}
							placeholder="Healthcare"
						/>
					</div>
					<div>
						<Label htmlFor="contact-org">Company</Label>
						<Input
							id="contact-org"
							value={form.orgName}
							onChange={(e) => setField("orgName", e.target.value)}
							placeholder="Acme Corp"
						/>
					</div>
				</div>
			</Modal>

			{/* ---- CSV import modal ---- */}
			<Modal
				open={importOpen}
				onClose={() => !importing && closeImport()}
				title="Import contacts from CSV"
				subtitle="Header row: firstName, lastName, email, title, industry, persona, orgName, aeOwner"
				size="lg"
				footer={
					<>
						<Button variant="ghost" onClick={closeImport} disabled={importing}>
							Cancel
						</Button>
						<Button
							variant="primary"
							onClick={runImport}
							disabled={importing || !parsed || !!parsed.headerError || parsed.rows.length === 0}
						>
							{importing && <Spinner />}
							Import {parsed && !parsed.headerError && parsed.rows.length > 0 ? num(parsed.rows.length) : ""}{" "}
							contacts
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<label className="glass-inset flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm">
						<span className="inline-flex items-center gap-2 text-muted">
							<Upload size={15} className="text-faint" />
							{fileName ?? "Choose a .csv file, or paste rows below"}
						</span>
						<span className="rounded-lg border border-hairline px-2 py-1 text-xs font-medium text-fg">Browse</span>
						<input
							type="file"
							accept=".csv,text/csv,text/plain"
							className="hidden"
							onChange={async (e) => {
								const file = e.target.files?.[0];
								if (!file) return;
								setFileName(file.name);
								setCsvText(await file.text());
								e.target.value = "";
							}}
						/>
					</label>

					<Textarea
						value={csvText}
						onChange={(e) => {
							setCsvText(e.target.value);
							setFileName(null);
						}}
						rows={10}
						className="min-h-48 font-mono text-xs"
						placeholder={
							"firstName,lastName,email,title,industry,persona,orgName,aeOwner\nJane,Doe,jane.doe@acme.com,VP Ops,Healthcare,LINE_OF_BUSINESS,Acme Corp,Greg"
						}
					/>

					{parsed &&
						(parsed.headerError ? (
							<div className="rounded-xl border border-hairline bg-[var(--accent-soft)] p-3 text-sm text-[var(--warn)]">
								{parsed.headerError}
							</div>
						) : (
							<div className="rounded-xl glass p-3 text-sm">
								<p className="font-medium text-fg">
									{num(parsed.rows.length)} row{parsed.rows.length === 1 ? "" : "s"} ready to import
									{parsed.skipped.length > 0 && (
										<span className="text-muted"> · {num(parsed.skipped.length)} will be skipped</span>
									)}
									{parsed.rows.length > 5000 && (
										<span className="text-[var(--warn)]"> · capped at 5,000 per import</span>
									)}
								</p>
								{parsed.skipped.length > 0 && (
									<ul className="mt-1.5 space-y-0.5 text-xs text-muted">
										{parsed.skipped.slice(0, 4).map((s) => (
											<li key={`${s.line}-${s.reason}`}>
												Line {s.line}: {s.reason}
											</li>
										))}
										{parsed.skipped.length > 4 && <li>…and {num(parsed.skipped.length - 4)} more</li>}
									</ul>
								)}
							</div>
						))}
				</div>
			</Modal>

			<ConfirmDialog
				open={confirmDelete}
				title="Delete contact"
				message={
					contact
						? `Delete ${contact.firstName} ${contact.lastName} (${contact.email})? This removes their activity history and cannot be undone.`
						: "Delete this contact? This cannot be undone."
				}
				busy={deleting}
				onConfirm={deleteContact}
				onCancel={() => setConfirmDelete(false)}
			/>
		</>
	);
}
