"use client";

import { ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2, Upload, UserMinus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton, Spinner } from "@/components/ui/misc";
import { Modal, Sheet } from "@/components/ui/modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { useAsyncData } from "@/hooks/useApi";
import { ApiError, segmentsApi } from "@/lib/api";
import { fmtDate, num } from "@/lib/format";
import type { Persona, Segment, SegmentCreateInput, SegmentDetail, SegmentType } from "@/types/domain";

const MEMBER_PAGE_SIZE = 20;

const TYPE_LABEL: Record<SegmentType, string> = {
	INDUSTRY: "Industry",
	AE: "AE Owner",
	PERSONA: "Persona",
	ALL: "All contacts",
	CC_LIST: "Constant Contact list",
};

/** Types selectable in the "New segment" form — CC_LIST is import-only, never created by hand. */
const CREATABLE_TYPES: SegmentType[] = ["INDUSTRY", "AE", "PERSONA", "ALL"];

const PERSONA_LABEL: Record<Persona, string> = {
	IT: "IT",
	LINE_OF_BUSINESS: "Line of Business",
	CUSTOMER_SERVICE: "Customer Service",
};

function criteriaLabel(segment: Segment): string {
	const c = segment.criteria ?? {};
	if (segment.type === "ALL") return "Every contact";
	if (segment.type === "CC_LIST") return "Membership synced from Constant Contact";
	if (segment.type === "INDUSTRY" && c.industry) return `Industry is “${c.industry}”`;
	if (segment.type === "AE" && c.aeOwner) return `AE owner is “${c.aeOwner}”`;
	if (segment.type === "PERSONA" && c.persona) return `Persona is ${PERSONA_LABEL[c.persona] ?? c.persona}`;
	return "No criteria";
}

interface SegmentFormState {
	name: string;
	type: SegmentType;
	industry: string;
	aeOwner: string;
	persona: string;
}

const EMPTY_FORM: SegmentFormState = {
	name: "",
	type: "INDUSTRY",
	industry: "",
	aeOwner: "",
	persona: "",
};

export default function SegmentsPage() {
	const { token } = useAuth();
	const toast = useToast();

	const list = useAsyncData(() => segmentsApi.list(token), [token]);
	const segments = list.data?.items ?? [];

	// ---- create modal ----
	const [createOpen, setCreateOpen] = useState(false);
	const [form, setForm] = useState<SegmentFormState>(EMPTY_FORM);
	const [saving, setSaving] = useState(false);

	const setField = (key: "name" | "industry" | "aeOwner" | "persona", value: string) =>
		setForm((f) => ({ ...f, [key]: value }));

	const submitCreate = async () => {
		const name = form.name.trim();
		const criteriaValue =
			form.type === "INDUSTRY" ? form.industry.trim() : form.type === "AE" ? form.aeOwner.trim() : form.persona;
		if (!name) {
			toast("Segment name is required.", "warn");
			return;
		}
		if (form.type !== "ALL" && !criteriaValue) {
			toast(`Set the ${TYPE_LABEL[form.type].toLowerCase()} criteria first.`, "warn");
			return;
		}
		setSaving(true);
		try {
			const input: SegmentCreateInput = {
				name,
				type: form.type,
				criteria:
					form.type === "ALL"
						? { all: true }
						: form.type === "INDUSTRY"
							? { industry: form.industry.trim() }
							: form.type === "AE"
								? { aeOwner: form.aeOwner.trim() }
								: { persona: form.persona as Persona },
			};
			const { segment } = await segmentsApi.create(token, input);
			toast(`Segment created — ${num(segment.memberCount)} members matched`);
			setCreateOpen(false);
			setForm(EMPTY_FORM);
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setSaving(false);
		}
	};

	// ---- sync to Constant Contact ----
	const [syncingId, setSyncingId] = useState<string | null>(null);

	const syncSegment = async (segment: Segment) => {
		setSyncingId(segment.id);
		try {
			const result = await segmentsApi.syncToCc(token, segment.id);
			toast(`Pushed ${num(result.pushed)} contacts to Constant Contact`);
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setSyncingId(null);
		}
	};

	// ---- members sheet ----
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [memberPage, setMemberPage] = useState(1);

	// ---- delete ----
	const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
	const [deleting, setDeleting] = useState(false);

	const deleteSegment = async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			await segmentsApi.remove(token, deleteTarget.id);
			toast("Segment deleted");
			if (selectedId === deleteTarget.id) setSelectedId(null);
			setDeleteTarget(null);
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setDeleting(false);
		}
	};

	const detail = useAsyncData<SegmentDetail | null>(
		() =>
			selectedId
				? segmentsApi.get(token, selectedId, { page: memberPage, pageSize: MEMBER_PAGE_SIZE })
				: Promise.resolve(null),
		[token, selectedId, memberPage],
	);

	const openMembers = (id: string) => {
		setMemberPage(1);
		setSelectedId(id);
	};

	const selectedSegment = selectedId ? (detail.data?.segment ?? segments.find((s) => s.id === selectedId) ?? null) : null;
	const members = detail.data?.members;
	const memberPageCount = members ? Math.max(1, Math.ceil(members.total / MEMBER_PAGE_SIZE)) : 1;

	const [refreshing, setRefreshing] = useState(false);
	const [removingId, setRemovingId] = useState<string | null>(null);

	const refreshSegment = async () => {
		if (!selectedId) return;
		setRefreshing(true);
		try {
			const { memberCount } = await segmentsApi.refresh(token, selectedId);
			toast(`Segment refreshed — ${num(memberCount)} members`);
			setMemberPage(1);
			detail.reload();
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setRefreshing(false);
		}
	};

	const removeMember = async (contactId: string) => {
		if (!selectedId) return;
		setRemovingId(contactId);
		try {
			await segmentsApi.removeMember(token, selectedId, contactId);
			toast("Member removed");
			detail.reload();
			list.reload();
		} catch (err) {
			toast(err instanceof ApiError ? err.message : "Something went wrong", "warn");
		} finally {
			setRemovingId(null);
		}
	};

	// ---- totals for the header ----
	const totalMembers = useMemo(() => segments.reduce((sum, s) => sum + s.memberCount, 0), [segments]);

	return (
		<>
			<PageHeader
				title="Segments"
				subtitle={
					list.data
						? `${num(segments.length)} segments · ${num(totalMembers)} total members`
						: "Audience slices for targeted campaigns"
				}
				actions={
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						<Plus size={16} /> New segment
					</Button>
				}
			/>

			{list.error ? (
				<GlassCard>
					<EmptyState title="Couldn't load segments" hint={list.error} />
					<div className="flex justify-center pb-8">
						<Button variant="glass" onClick={list.reload}>
							<RefreshCw size={15} /> Retry
						</Button>
					</div>
				</GlassCard>
			) : list.loading && !list.data ? (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-40 w-full" />
					))}
				</div>
			) : segments.length === 0 ? (
				<GlassCard>
					<EmptyState
						icon={<Users size={28} />}
						title="No segments yet"
						hint="Create a segment by industry, AE owner or persona to target the right contacts."
					/>
					<div className="flex justify-center pb-8">
						<Button variant="primary" onClick={() => setCreateOpen(true)}>
							<Plus size={16} /> New segment
						</Button>
					</div>
				</GlassCard>
			) : (
				<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{segments.map((segment) => (
						<GlassCard key={segment.id} className="flex flex-col gap-3 p-4">
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<button
										type="button"
										onClick={() => openMembers(segment.id)}
										className="max-w-full truncate text-left text-base font-semibold tracking-tight text-emboss hover:underline"
									>
										{segment.name}
									</button>
									<div className="mt-1.5 flex flex-wrap items-center gap-2">
										<Badge tone="info">{TYPE_LABEL[segment.type]}</Badge>
										<span className="text-xs text-muted">{criteriaLabel(segment)}</span>
									</div>
								</div>
								<span
									className="mt-1 inline-flex shrink-0"
									title={
										segment.ccSynced
											? "Synced to a Constant Contact list"
											: "Not synced to Constant Contact yet"
									}
								>
									<Dot tone={segment.ccSynced ? "ok" : "neutral"} />
								</span>
							</div>

							<div className="flex items-center gap-3 text-sm text-muted">
								<span className="inline-flex items-center gap-1.5">
									<Users size={14} className="text-faint" />
									<span className="tnum font-medium text-fg">{num(segment.memberCount)}</span> members
								</span>
								<span className="text-xs text-faint">Created {fmtDate(segment.createdAt)}</span>
							</div>

							<div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
								<Button size="sm" variant="glass" onClick={() => openMembers(segment.id)}>
									<Users size={14} /> Members
								</Button>
								<Button
									size="sm"
									variant="glass"
									onClick={() => syncSegment(segment)}
									disabled={syncingId === segment.id}
								>
									{syncingId === segment.id ? <Spinner /> : <Upload size={14} />}
									Sync to CC
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => setDeleteTarget(segment)}
									aria-label={`Delete ${segment.name}`}
									className="text-[var(--danger)]"
								>
									<Trash2 size={14} />
								</Button>
							</div>
						</GlassCard>
					))}
				</div>
			)}

			{/* ---- members sheet ---- */}
			<Sheet
				open={selectedId !== null}
				onClose={() => setSelectedId(null)}
				title={selectedSegment?.name ?? "Segment"}
				subtitle={selectedSegment ? `${TYPE_LABEL[selectedSegment.type]} · ${criteriaLabel(selectedSegment)}` : undefined}
				width={560}
			>
				<div className="space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-sm text-muted">
							{members ? (
								<>
									<span className="tnum font-medium text-fg">{num(members.total)}</span> members
								</>
							) : (
								"Loading members…"
							)}
						</span>
						<Button size="sm" variant="glass" onClick={refreshSegment} disabled={refreshing}>
							{refreshing ? <Spinner /> : <RefreshCw size={14} />}
							Refresh from criteria
						</Button>
					</div>

					{detail.loading ? (
						<div className="space-y-2">
							{Array.from({ length: 6 }).map((_, i) => (
								<Skeleton key={i} className="h-12 w-full" />
							))}
						</div>
					) : detail.error ? (
						<>
							<EmptyState title="Couldn't load members" hint={detail.error} />
							<div className="flex justify-center">
								<Button variant="glass" onClick={detail.reload}>
									<RefreshCw size={15} /> Retry
								</Button>
							</div>
						</>
					) : members && members.items.length === 0 ? (
						<EmptyState
							title="No members"
							hint="No contacts match this segment's criteria yet. Refresh after importing contacts."
						/>
					) : members ? (
						<>
							<div className="overflow-x-auto rounded-xl glass">
								<table className="w-full min-w-[440px] border-collapse text-sm">
									<thead>
										<tr className="border-b border-hairline text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
											<th className="px-3 py-2">Name</th>
											<th className="px-3 py-2">Email</th>
											<th className="px-3 py-2">Company</th>
											<th className="px-3 py-2" aria-label="Actions" />
										</tr>
									</thead>
									<tbody>
										{members.items.map((m) => (
											<tr key={m.id} className="border-b border-hairline/60 last:border-0">
												<td className="whitespace-nowrap px-3 py-2 font-medium text-fg">
													{m.firstName} {m.lastName}
												</td>
												<td className="whitespace-nowrap px-3 py-2 text-muted">{m.email}</td>
												<td className="whitespace-nowrap px-3 py-2">
													{m.organization?.name ?? <span className="text-faint">—</span>}
												</td>
												<td className="px-3 py-2 text-right">
													<Button
														size="icon"
														variant="ghost"
														onClick={() => removeMember(m.id)}
														disabled={removingId === m.id}
														aria-label={`Remove ${m.firstName} ${m.lastName}`}
														title="Remove from segment"
														className="h-7 w-7 text-[var(--danger)]"
													>
														{removingId === m.id ? <Spinner /> : <UserMinus size={14} />}
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{memberPageCount > 1 && (
								<div className="flex items-center justify-between gap-2 text-sm text-muted">
									<span className="tnum">
										Page {memberPage} of {memberPageCount}
									</span>
									<div className="flex items-center gap-1.5">
										<Button
											variant="glass"
											size="icon"
											onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
											disabled={memberPage <= 1}
											aria-label="Previous page"
										>
											<ChevronLeft size={16} />
										</Button>
										<Button
											variant="glass"
											size="icon"
											onClick={() => setMemberPage((p) => Math.min(memberPageCount, p + 1))}
											disabled={memberPage >= memberPageCount}
											aria-label="Next page"
										>
											<ChevronRight size={16} />
										</Button>
									</div>
								</div>
							)}
						</>
					) : null}

					{selectedSegment && (
						<div className="flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
							<Button
								size="sm"
								variant="glass"
								onClick={() => syncSegment(selectedSegment)}
								disabled={syncingId === selectedSegment.id}
							>
								{syncingId === selectedSegment.id ? <Spinner /> : <Upload size={14} />}
								Sync to Constant Contact
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setDeleteTarget(selectedSegment)}
								className="text-[var(--danger)]"
							>
								<Trash2 size={14} /> Delete segment
							</Button>
						</div>
					)}
				</div>
			</Sheet>

			{/* ---- create modal ---- */}
			<Modal
				open={createOpen}
				onClose={() => !saving && setCreateOpen(false)}
				title="New segment"
				subtitle="Members are matched automatically from your contact database."
				footer={
					<>
						<Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submitCreate} disabled={saving}>
							{saving && <Spinner />}
							Create segment
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<div>
						<Label htmlFor="segment-name">Name</Label>
						<Input
							id="segment-name"
							value={form.name}
							onChange={(e) => setField("name", e.target.value)}
							placeholder="Healthcare buyers"
						/>
					</div>
					<div>
						<Label htmlFor="segment-type">Type</Label>
						<Select
							id="segment-type"
							value={form.type}
							onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SegmentType }))}
						>
							{CREATABLE_TYPES.map((t) => (
								<option key={t} value={t}>
									{TYPE_LABEL[t]}
								</option>
							))}
						</Select>
					</div>
					{form.type === "INDUSTRY" && (
						<div>
							<Label htmlFor="segment-industry">Industry</Label>
							<Input
								id="segment-industry"
								value={form.industry}
								onChange={(e) => setField("industry", e.target.value)}
								placeholder="Healthcare"
							/>
							<p className="mt-1 text-xs text-faint">
								Matches contacts whose industry — or their company's industry — equals this value.
							</p>
						</div>
					)}
					{form.type === "AE" && (
						<div>
							<Label htmlFor="segment-ae">AE owner</Label>
							<Input
								id="segment-ae"
								value={form.aeOwner}
								onChange={(e) => setField("aeOwner", e.target.value)}
								placeholder="Greg"
							/>
							<p className="mt-1 text-xs text-faint">Matches contacts whose company is owned by this AE.</p>
						</div>
					)}
					{form.type === "PERSONA" && (
						<div>
							<Label htmlFor="segment-persona">Persona</Label>
							<Select
								id="segment-persona"
								value={form.persona}
								onChange={(e) => setField("persona", e.target.value)}
							>
								<option value="">Select a persona…</option>
								{(Object.keys(PERSONA_LABEL) as Persona[]).map((p) => (
									<option key={p} value={p}>
										{PERSONA_LABEL[p]}
									</option>
								))}
							</Select>
						</div>
					)}
					{form.type === "ALL" && (
						<p className="text-xs text-faint">
							Includes every contact in your database — no criteria needed.
						</p>
					)}
				</div>
			</Modal>

			{/* ---- delete confirm ---- */}
			<Modal
				open={deleteTarget !== null}
				onClose={() => !deleting && setDeleteTarget(null)}
				title="Delete segment"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
							Cancel
						</Button>
						<Button variant="danger" onClick={deleteSegment} disabled={deleting}>
							{deleting && <Spinner />}
							Delete
						</Button>
					</>
				}
			>
				<p className="text-sm text-muted">
					{deleteTarget
						? `Delete “${deleteTarget.name}” (${num(deleteTarget.memberCount)} members)? Contacts themselves are kept — only the segment is removed.`
						: ""}
				</p>
			</Modal>
		</>
	);
}
