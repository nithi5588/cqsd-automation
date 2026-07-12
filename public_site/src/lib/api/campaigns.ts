import type {
	CampaignActivityParams,
	CampaignActivityRow,
	CampaignCreateInput,
	CampaignDetail,
	CampaignListItem,
	CampaignListParams,
	CampaignStat,
	CampaignUpdateInput,
	CompanyActivityRow,
	Paginated,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const campaignsApi = {
	list(
		token: string | null,
		params: CampaignListParams = {},
	): Promise<Paginated<CampaignListItem>> {
		return apiRequest<Paginated<CampaignListItem>>(
			`/campaigns${toQuery({
				status: params.status,
				search: params.search,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	create(
		token: string | null,
		input: CampaignCreateInput,
	): Promise<{ campaign: CampaignListItem }> {
		return apiRequest<{ campaign: CampaignListItem }>("/campaigns", {
			method: "POST",
			body: input,
			token,
		});
	},

	get(token: string | null, id: string): Promise<{ campaign: CampaignDetail }> {
		return apiRequest<{ campaign: CampaignDetail }>(`/campaigns/${id}`, { token });
	},

	update(
		token: string | null,
		id: string,
		input: CampaignUpdateInput,
	): Promise<{ campaign: CampaignListItem }> {
		return apiRequest<{ campaign: CampaignListItem }>(`/campaigns/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	remove(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/campaigns/${id}`, { method: "DELETE", token });
	},

	pushToCc(token: string | null, id: string): Promise<{ campaign: CampaignListItem }> {
		return apiRequest<{ campaign: CampaignListItem }>(`/campaigns/${id}/push-to-cc`, {
			method: "POST",
			token,
		});
	},

	sendTest(token: string | null, id: string, emails: string[]): Promise<{ ok: boolean }> {
		return apiRequest<{ ok: boolean }>(`/campaigns/${id}/send-test`, {
			method: "POST",
			body: { emails },
			token,
		});
	},

	schedule(
		token: string | null,
		id: string,
		scheduledAt: string,
	): Promise<{ campaign: CampaignListItem }> {
		return apiRequest<{ campaign: CampaignListItem }>(`/campaigns/${id}/schedule`, {
			method: "POST",
			body: { scheduledAt },
			token,
		});
	},

	unschedule(token: string | null, id: string): Promise<{ campaign: CampaignListItem }> {
		return apiRequest<{ campaign: CampaignListItem }>(`/campaigns/${id}/unschedule`, {
			method: "POST",
			token,
		});
	},

	syncStats(token: string | null, id: string): Promise<{ stat: CampaignStat }> {
		return apiRequest<{ stat: CampaignStat }>(`/campaigns/${id}/sync-stats`, {
			method: "POST",
			token,
		});
	},

	activity(
		token: string | null,
		id: string,
		params: CampaignActivityParams = {},
	): Promise<Paginated<CampaignActivityRow>> {
		return apiRequest<Paginated<CampaignActivityRow>>(
			`/campaigns/${id}/activity${toQuery({
				filter: params.filter,
				search: params.search,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	activityByCompany(token: string | null, id: string): Promise<{ items: CompanyActivityRow[] }> {
		return apiRequest<{ items: CompanyActivityRow[] }>(`/campaigns/${id}/activity/by-company`, {
			token,
		});
	},
};
