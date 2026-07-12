import type {
	AccountPlan,
	AccountPlanListItem,
	AccountPlanListParams,
	Paginated,
} from "@/types/domain";
import { API_BASE_URL, ApiError, apiRequest } from "./client";
import { toQuery } from "./query";

/** Absolute URL of the CSV export endpoint for an organization's account plan. */
export function accountPlanExportUrl(orgId: string): string {
	return `${API_BASE_URL}/account-plans/${orgId}/export`;
}

export const accountPlansApi = {
	list(
		token: string | null,
		params: AccountPlanListParams = {},
	): Promise<Paginated<AccountPlanListItem>> {
		return apiRequest<Paginated<AccountPlanListItem>>(
			`/account-plans${toQuery({
				search: params.search,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	get(token: string | null, orgId: string): Promise<AccountPlan> {
		return apiRequest<AccountPlan>(`/account-plans/${orgId}`, { token });
	},

	/**
	 * Fetches the account-plan CSV with the Bearer token and triggers a browser
	 * download. The export endpoint returns text/csv, so it cannot go through
	 * `apiRequest` (which expects JSON payloads).
	 */
	async downloadExport(token: string | null, orgId: string): Promise<void> {
		const headers: Record<string, string> = {};
		if (token) headers.Authorization = `Bearer ${token}`;

		const response = await fetch(accountPlanExportUrl(orgId), { headers });

		if (!response.ok) {
			const contentType = response.headers.get("content-type") ?? "";
			const payload = contentType.includes("application/json")
				? ((await response.json()) as { error?: { code?: string; message?: string } })
				: undefined;
			throw new ApiError(
				response.status,
				payload?.error?.code ?? "UNKNOWN_ERROR",
				payload?.error?.message ?? response.statusText,
			);
		}

		const blob = await response.blob();
		const disposition = response.headers.get("content-disposition") ?? "";
		const match = /filename="([^"]+)"/.exec(disposition);
		const filename = match?.[1] ?? `account-plan-${orgId}.csv`;

		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(url);
	},
};
