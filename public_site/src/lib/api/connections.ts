import type { CcAccountInfo, CcImportJobStatus, ConnectionsStatus } from "@/types";
import { API_BASE_URL, apiRequest } from "./client";

export const connectionsApi = {
	status(token: string): Promise<ConnectionsStatus> {
		return apiRequest<ConnectionsStatus>("/connections", { token });
	},
	/**
	 * Starts a background pull of every existing list/segment/contact/campaign
	 * from the connected CC account — safe to re-run. Returns immediately with a
	 * job id; poll `importStatus` for the result since a real account can take
	 * minutes to page through, well past a single request's lifetime.
	 */
	startImportConstantContact(token: string): Promise<{ jobId: string }> {
		return apiRequest<{ jobId: string }>("/connections/constant-contact/import", { method: "POST", token });
	},
	importStatus(token: string, jobId: string): Promise<CcImportJobStatus> {
		return apiRequest<CcImportJobStatus>(`/connections/constant-contact/import/${jobId}`, { token });
	},
	constantContactAccountInfo(token: string): Promise<{ account: CcAccountInfo }> {
		return apiRequest<{ account: CcAccountInfo }>("/connections/constant-contact/account", { token });
	},
};

export type OAuthProviderPath = "constant-contact" | "microsoft";

/** A plain browser navigation target (302 to the provider's consent screen) — not a fetch call. */
export function oauthStartUrl(provider: OAuthProviderPath): string {
	return `${API_BASE_URL}/oauth/${provider}/start`;
}
