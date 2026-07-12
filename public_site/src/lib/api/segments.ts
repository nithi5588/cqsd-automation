import type {
	PageParams,
	Segment,
	SegmentCreateInput,
	SegmentDetail,
	SegmentSyncResult,
	SegmentUpdateInput,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const segmentsApi = {
	list(token: string | null): Promise<{ items: Segment[] }> {
		return apiRequest<{ items: Segment[] }>("/segments", { token });
	},

	create(token: string | null, input: SegmentCreateInput): Promise<{ segment: Segment }> {
		return apiRequest<{ segment: Segment }>("/segments", {
			method: "POST",
			body: input,
			token,
		});
	},

	get(token: string | null, id: string, params: PageParams = {}): Promise<SegmentDetail> {
		return apiRequest<SegmentDetail>(
			`/segments/${id}${toQuery({ page: params.page, pageSize: params.pageSize })}`,
			{ token },
		);
	},

	update(
		token: string | null,
		id: string,
		input: SegmentUpdateInput,
	): Promise<{ segment: Segment }> {
		return apiRequest<{ segment: Segment }>(`/segments/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	remove(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/segments/${id}`, { method: "DELETE", token });
	},

	refresh(token: string | null, id: string): Promise<{ memberCount: number }> {
		return apiRequest<{ memberCount: number }>(`/segments/${id}/refresh`, {
			method: "POST",
			token,
		});
	},

	addMembers(
		token: string | null,
		id: string,
		contactIds: string[],
	): Promise<{ memberCount: number }> {
		return apiRequest<{ memberCount: number }>(`/segments/${id}/members`, {
			method: "POST",
			body: { contactIds },
			token,
		});
	},

	removeMember(token: string | null, id: string, contactId: string): Promise<void> {
		return apiRequest<void>(`/segments/${id}/members/${contactId}`, {
			method: "DELETE",
			token,
		});
	},

	syncToCc(token: string | null, id: string): Promise<SegmentSyncResult> {
		return apiRequest<SegmentSyncResult>(`/segments/${id}/sync-to-cc`, {
			method: "POST",
			token,
		});
	},
};
