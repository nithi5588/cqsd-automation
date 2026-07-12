import type { ConnectionsStatus } from "@/types";
import { API_BASE_URL, apiRequest } from "./client";

export const connectionsApi = {
	status(token: string): Promise<ConnectionsStatus> {
		return apiRequest<ConnectionsStatus>("/connections", { token });
	},
};

export type OAuthProviderPath = "constant-contact" | "microsoft";

/** A plain browser navigation target (302 to the provider's consent screen) — not a fetch call. */
export function oauthStartUrl(provider: OAuthProviderPath): string {
	return `${API_BASE_URL}/oauth/${provider}/start`;
}
