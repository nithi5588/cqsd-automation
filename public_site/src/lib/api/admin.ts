import type {
	AdminUser,
	AdminUserCreateInput,
	AdminUserUpdateInput,
	AuditRow,
	PageParams,
	Paginated,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const adminApi = {
	listUsers(token: string | null): Promise<{ items: AdminUser[] }> {
		return apiRequest<{ items: AdminUser[] }>("/admin/users", { token });
	},

	createUser(token: string | null, input: AdminUserCreateInput): Promise<{ user: AdminUser }> {
		return apiRequest<{ user: AdminUser }>("/admin/users", {
			method: "POST",
			body: input,
			token,
		});
	},

	updateUser(
		token: string | null,
		id: string,
		input: AdminUserUpdateInput,
	): Promise<{ user: AdminUser }> {
		return apiRequest<{ user: AdminUser }>(`/admin/users/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	deleteUser(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/admin/users/${id}`, { method: "DELETE", token });
	},

	audit(token: string | null, params: PageParams = {}): Promise<Paginated<AuditRow>> {
		return apiRequest<Paginated<AuditRow>>(
			`/admin/audit${toQuery({ page: params.page, pageSize: params.pageSize })}`,
			{ token },
		);
	},
};
