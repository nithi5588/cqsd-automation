"use client";

import {
	ChevronLeft,
	ChevronRight,
	KeyRound,
	MoreHorizontal,
	RefreshCw,
	ScrollText,
	ShieldAlert,
	ShieldCheck,
	Trash2,
	UserPlus,
	Users,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/Toast";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/data-table";
import { Input, Label, Select } from "@/components/ui/field";
import { GlassCard } from "@/components/ui/glass";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Modal } from "@/components/ui/modal";
import { MenuItem, MenuList, Popover } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/tabs";
import { useAsyncData } from "@/hooks/useApi";
import { adminApi, ApiError } from "@/lib/api";
import { fmtDateTime, fromNow } from "@/lib/format";
import type { AdminUser, AuditRow, Paginated, UserRole } from "@/types/domain";

const AUDIT_PAGE_SIZE = 25;

type AdminTab = "users" | "audit";

interface UserForm {
	email: string;
	password: string;
	role: UserRole;
}

const emptyUserForm = (): UserForm => ({ email: "", password: "", role: "MEMBER" });

/** Random 16-char password (mixed case, digits, symbols; ambiguous glyphs excluded). */
function generatePassword(): string {
	const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
	const bytes = new Uint32Array(16);
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

function metaJson(meta: unknown): string {
	if (meta === null || meta === undefined) return "";
	if (typeof meta === "string") return meta;
	try {
		return JSON.stringify(meta);
	} catch {
		return String(meta);
	}
}

function errMsg(err: unknown): string {
	return err instanceof ApiError ? err.message : "Something went wrong";
}

function LoadError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
	return (
		<GlassCard>
			<EmptyState title={title} hint={message} />
			<div className="flex justify-center pb-10">
				<Button variant="glass" onClick={onRetry}>
					<RefreshCw size={15} /> Retry
				</Button>
			</div>
		</GlassCard>
	);
}

function TableSkeleton() {
	return (
		<GlassCard className="space-y-3 p-4">
			<Skeleton className="h-9 w-64" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
			<Skeleton className="h-10 w-full" />
		</GlassCard>
	);
}

export default function AdminPage() {
	const { user, token } = useAuth();
	const toast = useToast();
	const isAdmin = user?.role === "ADMIN";

	const [tab, setTab] = useState<AdminTab>("users");
	const [auditPage, setAuditPage] = useState(1);

	// modals
	const [addOpen, setAddOpen] = useState(false);
	const [addForm, setAddForm] = useState<UserForm>(emptyUserForm());
	const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
	const [resetPassword, setResetPassword] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
	const [busy, setBusy] = useState(false);

	const users = useAsyncData<{ items: AdminUser[] }>(
		() => (isAdmin ? adminApi.listUsers(token) : Promise.resolve({ items: [] })),
		[token, isAdmin],
	);
	const audit = useAsyncData<Paginated<AuditRow>>(
		() =>
			isAdmin
				? adminApi.audit(token, { page: auditPage, pageSize: AUDIT_PAGE_SIZE })
				: Promise.resolve({ items: [], page: 1, pageSize: AUDIT_PAGE_SIZE, total: 0 }),
		[token, isAdmin, auditPage],
	);

	if (user && !isAdmin) {
		return (
			<>
				<PageHeader title="Admin" subtitle="User management and audit trail" />
				<GlassCard>
					<EmptyState
						icon={<ShieldAlert size={28} />}
						title="Admins only"
						hint="You need the ADMIN role to manage users and view the audit log."
					/>
				</GlassCard>
			</>
		);
	}

	/* ---------------- mutations ---------------- */

	const handleCreateUser = async () => {
		const email = addForm.email.trim().toLowerCase();
		if (!/^\S+@\S+\.\S+$/.test(email)) {
			toast("Enter a valid email address", "warn");
			return;
		}
		if (addForm.password.length < 8) {
			toast("Password must be at least 8 characters", "warn");
			return;
		}
		setBusy(true);
		try {
			await adminApi.createUser(token, { email, password: addForm.password, role: addForm.role });
			toast(`User ${email} created`);
			setAddOpen(false);
			setAddForm(emptyUserForm());
			users.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setBusy(false);
		}
	};

	const handleChangeRole = async (target: AdminUser) => {
		const nextRole: UserRole = target.role === "ADMIN" ? "MEMBER" : "ADMIN";
		try {
			await adminApi.updateUser(token, target.id, { role: nextRole });
			toast(`${target.email} is now ${nextRole === "ADMIN" ? "an admin" : "a member"}`);
			users.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		}
	};

	const handleResetPassword = async () => {
		if (!resetTarget) return;
		if (resetPassword.length < 8) {
			toast("Password must be at least 8 characters", "warn");
			return;
		}
		setBusy(true);
		try {
			await adminApi.updateUser(token, resetTarget.id, { password: resetPassword });
			toast(`Password updated for ${resetTarget.email}`);
			setResetTarget(null);
			setResetPassword("");
			users.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setBusy(false);
		}
	};

	const handleDeleteUser = async () => {
		if (!deleteTarget) return;
		setBusy(true);
		try {
			await adminApi.deleteUser(token, deleteTarget.id);
			toast(`${deleteTarget.email} deleted`);
			setDeleteTarget(null);
			users.reload();
		} catch (err) {
			toast(errMsg(err), "warn");
		} finally {
			setBusy(false);
		}
	};

	/* ---------------- columns ---------------- */

	const userColumns: ColumnDef<AdminUser>[] = [
		{
			accessorKey: "email",
			header: "Email",
			cell: ({ row }) => <span className="font-medium text-fg">{row.original.email}</span>,
		},
		{
			accessorKey: "role",
			header: "Role",
			cell: ({ row }) => (
				<Badge tone={row.original.role === "ADMIN" ? "info" : "neutral"}>
					{row.original.role === "ADMIN" ? "Admin" : "Member"}
				</Badge>
			),
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			cell: ({ row }) => (
				<span className="text-muted" title={fmtDateTime(row.original.createdAt)}>
					{fmtDateTime(row.original.createdAt)}
				</span>
			),
		},
		{
			id: "actions",
			header: "",
			enableSorting: false,
			cell: ({ row }) => {
				const target = row.original;
				const isSelf = target.id === user?.id;
				return (
					<div className="flex justify-end">
						<Popover
							width={220}
							trigger={({ toggle }) => (
								<Button variant="ghost" size="icon" onClick={toggle} aria-label={`Actions for ${target.email}`}>
									<MoreHorizontal size={16} />
								</Button>
							)}
						>
							{(close) => (
								<MenuList>
									<MenuItem
										icon={<ShieldCheck size={15} />}
										onClick={() => {
											close();
											void handleChangeRole(target);
										}}
									>
										{target.role === "ADMIN" ? "Change role to Member" : "Change role to Admin"}
									</MenuItem>
									<MenuItem
										icon={<KeyRound size={15} />}
										onClick={() => {
											close();
											setResetPassword("");
											setResetTarget(target);
										}}
									>
										Reset password
									</MenuItem>
									{isSelf ? (
										<div
											className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium text-faint opacity-60"
											title="You cannot delete your own account"
										>
											<Trash2 size={15} />
											Delete user
										</div>
									) : (
										<MenuItem
											danger
											icon={<Trash2 size={15} />}
											onClick={() => {
												close();
												setDeleteTarget(target);
											}}
										>
											Delete user
										</MenuItem>
									)}
								</MenuList>
							)}
						</Popover>
					</div>
				);
			},
		},
	];

	const auditColumns: ColumnDef<AuditRow>[] = [
		{
			accessorKey: "createdAt",
			header: "When",
			cell: ({ row }) => (
				<div>
					<div className="text-fg">{fromNow(row.original.createdAt)}</div>
					<div className="text-xs text-faint">{fmtDateTime(row.original.createdAt)}</div>
				</div>
			),
		},
		{
			accessorKey: "userEmail",
			header: "User",
			cell: ({ row }) =>
				row.original.userEmail ? (
					<span className="text-fg">{row.original.userEmail}</span>
				) : (
					<span className="text-faint">System</span>
				),
		},
		{
			accessorKey: "action",
			header: "Action",
			cell: ({ row }) => <Badge>{row.original.action}</Badge>,
		},
		{
			accessorKey: "entity",
			header: "Entity",
			cell: ({ row }) => <span className="font-mono text-xs text-muted">{row.original.entity}</span>,
		},
		{
			id: "meta",
			header: "Details",
			enableSorting: false,
			cell: ({ row }) => {
				const full = metaJson(row.original.meta);
				if (!full) return <span className="text-faint">—</span>;
				return (
					<span className="block max-w-[300px] truncate font-mono text-xs text-muted" title={full}>
						{full}
					</span>
				);
			},
		},
	];

	/* ---------------- render ---------------- */

	const auditTotal = audit.data?.total ?? 0;
	const auditPages = Math.max(1, Math.ceil(auditTotal / AUDIT_PAGE_SIZE));

	return (
		<>
			<PageHeader
				title="Admin"
				subtitle="Manage workspace users and review the audit trail"
				actions={
					<Button
						variant="primary"
						onClick={() => {
							setAddForm(emptyUserForm());
							setAddOpen(true);
						}}
					>
						<UserPlus size={16} /> Add user
					</Button>
				}
			/>

			<Segmented<AdminTab>
				className="mb-4"
				value={tab}
				onChange={setTab}
				items={[
					{ value: "users", label: "Users", icon: <Users size={15} />, count: users.data?.items.length },
					{ value: "audit", label: "Audit log", icon: <ScrollText size={15} />, count: audit.data?.total },
				]}
			/>

			{tab === "users" &&
				(users.loading ? (
					<TableSkeleton />
				) : users.error ? (
					<LoadError title="Could not load users" message={users.error} onRetry={users.reload} />
				) : (
					<DataTable<AdminUser>
						data={users.data?.items ?? []}
						columns={userColumns}
						searchPlaceholder="Search users…"
						pageSize={25}
						initialSorting={[{ id: "createdAt", desc: true }]}
					/>
				))}

			{tab === "audit" &&
				(audit.loading ? (
					<TableSkeleton />
				) : audit.error ? (
					<LoadError title="Could not load audit log" message={audit.error} onRetry={audit.reload} />
				) : (
					<>
						<DataTable<AuditRow>
							data={audit.data?.items ?? []}
							columns={auditColumns}
							searchPlaceholder="Search this page…"
							pageSize={AUDIT_PAGE_SIZE}
						/>
						<div className="mt-3 flex items-center justify-between gap-2 px-1 text-sm text-muted">
							<span className="tnum">
								{auditTotal} entries · page {auditPage} of {auditPages}
							</span>
							<div className="flex items-center gap-1.5">
								<Button
									variant="glass"
									size="icon"
									onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
									disabled={auditPage <= 1}
									aria-label="Previous page"
								>
									<ChevronLeft size={16} />
								</Button>
								<Button
									variant="glass"
									size="icon"
									onClick={() => setAuditPage((p) => Math.min(auditPages, p + 1))}
									disabled={auditPage >= auditPages}
									aria-label="Next page"
								>
									<ChevronRight size={16} />
								</Button>
							</div>
						</div>
					</>
				))}

			{/* ---- add user ---- */}
			<Modal
				open={addOpen}
				onClose={() => {
					if (!busy) setAddOpen(false);
				}}
				title="Add user"
				subtitle="Create an account and share the credentials with your teammate"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setAddOpen(false)} disabled={busy}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleCreateUser} disabled={busy}>
							{busy ? "Creating…" : "Create user"}
						</Button>
					</>
				}
			>
				<div className="space-y-4">
					<div>
						<Label htmlFor="admin-new-email">Email</Label>
						<Input
							id="admin-new-email"
							type="email"
							value={addForm.email}
							onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
							placeholder="name@company.com"
							autoComplete="off"
						/>
					</div>
					<div>
						<Label htmlFor="admin-new-password">Password</Label>
						<div className="flex gap-2">
							<Input
								id="admin-new-password"
								value={addForm.password}
								onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))}
								placeholder="Min 8 characters"
								autoComplete="new-password"
							/>
							<Button
								type="button"
								variant="glass"
								onClick={() => setAddForm((f) => ({ ...f, password: generatePassword() }))}
								title="Generate a strong password"
							>
								<RefreshCw size={15} /> Generate
							</Button>
						</div>
					</div>
					<div>
						<Label htmlFor="admin-new-role">Role</Label>
						<Select
							id="admin-new-role"
							value={addForm.role}
							onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value as UserRole }))}
						>
							<option value="MEMBER">Member</option>
							<option value="ADMIN">Admin</option>
						</Select>
					</div>
				</div>
			</Modal>

			{/* ---- reset password ---- */}
			<Modal
				open={resetTarget !== null}
				onClose={() => {
					if (!busy) setResetTarget(null);
				}}
				title="Reset password"
				subtitle={resetTarget?.email}
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setResetTarget(null)} disabled={busy}>
							Cancel
						</Button>
						<Button variant="primary" onClick={handleResetPassword} disabled={busy}>
							{busy ? "Saving…" : "Set password"}
						</Button>
					</>
				}
			>
				<div>
					<Label htmlFor="admin-reset-password">New password</Label>
					<div className="flex gap-2">
						<Input
							id="admin-reset-password"
							value={resetPassword}
							onChange={(e) => setResetPassword(e.target.value)}
							placeholder="Min 8 characters"
							autoComplete="new-password"
						/>
						<Button
							type="button"
							variant="glass"
							onClick={() => setResetPassword(generatePassword())}
							title="Generate a strong password"
						>
							<RefreshCw size={15} /> Generate
						</Button>
					</div>
					<p className="mt-2 text-xs text-faint">
						Share the new password with the user securely — it is only visible here.
					</p>
				</div>
			</Modal>

			{/* ---- delete confirm ---- */}
			<Modal
				open={deleteTarget !== null}
				onClose={() => {
					if (!busy) setDeleteTarget(null);
				}}
				title="Delete user"
				subtitle={deleteTarget?.email}
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={busy}>
							Cancel
						</Button>
						<Button variant="danger" onClick={handleDeleteUser} disabled={busy}>
							{busy ? "Deleting…" : "Delete user"}
						</Button>
					</>
				}
			>
				<p className="text-sm text-muted">
					This permanently removes <span className="font-medium text-fg">{deleteTarget?.email}</span> and revokes
					their access. This action cannot be undone.
				</p>
			</Modal>
		</>
	);
}
