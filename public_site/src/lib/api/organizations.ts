import type {
	Organization,
	OrganizationCreateInput,
	OrganizationDetail,
	OrganizationListItem,
	OrganizationListParams,
	OrganizationUpdateInput,
	Paginated,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const organizationsApi = {
	list(
		token: string | null,
		params: OrganizationListParams = {},
	): Promise<Paginated<OrganizationListItem>> {
		return apiRequest<Paginated<OrganizationListItem>>(
			`/organizations${toQuery({
				search: params.search,
				industry: params.industry,
				aeOwner: params.aeOwner,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	create(
		token: string | null,
		input: OrganizationCreateInput,
	): Promise<{ organization: Organization }> {
		return apiRequest<{ organization: Organization }>("/organizations", {
			method: "POST",
			body: input,
			token,
		});
	},

	get(token: string | null, id: string): Promise<{ organization: OrganizationDetail }> {
		return apiRequest<{ organization: OrganizationDetail }>(`/organizations/${id}`, { token });
	},

	update(
		token: string | null,
		id: string,
		input: OrganizationUpdateInput,
	): Promise<{ organization: Organization }> {
		return apiRequest<{ organization: Organization }>(`/organizations/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	remove(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/organizations/${id}`, { method: "DELETE", token });
	},
};
