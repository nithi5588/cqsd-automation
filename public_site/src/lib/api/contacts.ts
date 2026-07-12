import type {
	ContactCreateInput,
	ContactDetail,
	ContactImportInput,
	ContactListItem,
	ContactListParams,
	ContactUpdateInput,
	ImportResult,
	Paginated,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const contactsApi = {
	list(
		token: string | null,
		params: ContactListParams = {},
	): Promise<Paginated<ContactListItem>> {
		return apiRequest<Paginated<ContactListItem>>(
			`/contacts${toQuery({
				search: params.search,
				persona: params.persona,
				industry: params.industry,
				orgId: params.orgId,
				segmentId: params.segmentId,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	create(token: string | null, input: ContactCreateInput): Promise<{ contact: ContactListItem }> {
		return apiRequest<{ contact: ContactListItem }>("/contacts", {
			method: "POST",
			body: input,
			token,
		});
	},

	get(token: string | null, id: string): Promise<{ contact: ContactDetail }> {
		return apiRequest<{ contact: ContactDetail }>(`/contacts/${id}`, { token });
	},

	update(
		token: string | null,
		id: string,
		input: ContactUpdateInput,
	): Promise<{ contact: ContactListItem }> {
		return apiRequest<{ contact: ContactListItem }>(`/contacts/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	remove(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/contacts/${id}`, { method: "DELETE", token });
	},

	importContacts(token: string | null, input: ContactImportInput): Promise<ImportResult> {
		return apiRequest<ImportResult>("/contacts/import", {
			method: "POST",
			body: input,
			token,
		});
	},
};
