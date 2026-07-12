import { ExternalApiError } from "@cqsd/shared/http";

/**
 * `getValidAccessToken` throws `ExternalApiError(provider, "Not connected — complete
 * OAuth in Connections")` when a provider has never been through the OAuth flow.
 * That state is completely expected in dev and on fresh installs, so processors
 * log-and-skip instead of letting BullMQ burn ten retries on a job that cannot
 * succeed until a human connects the account on the Connections page.
 */
export function isNotConnectedError(error: unknown): boolean {
	return error instanceof ExternalApiError && error.message.includes("Not connected");
}
