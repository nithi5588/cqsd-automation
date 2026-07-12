import type { LeadImportJob, PageParams, Paginated } from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

export const leadsApi = {
	imports(token: string | null, params: PageParams = {}): Promise<Paginated<LeadImportJob>> {
		return apiRequest<Paginated<LeadImportJob>>(
			`/leads/imports${toQuery({ page: params.page, pageSize: params.pageSize })}`,
			{ token },
		);
	},
};
