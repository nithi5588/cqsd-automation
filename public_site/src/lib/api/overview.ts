import type { OverviewData } from "@/types/domain";
import { apiRequest } from "./client";

export const overviewApi = {
	get(token: string | null): Promise<OverviewData> {
		return apiRequest<OverviewData>("/overview", { token });
	},
};
