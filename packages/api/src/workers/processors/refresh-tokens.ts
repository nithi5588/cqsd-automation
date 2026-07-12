import { childLogger } from "@cqsd/shared/logger";
import { getValidAccessToken } from "../../infrastructure/integrations";
import { isNotConnectedError } from "./errors";

const log = childLogger("workers:refresh-tokens");

const PROVIDERS = ["CONSTANT_CONTACT", "MICROSOFT"] as const;

/**
 * Proactively exercises `getValidAccessToken` for both providers so tokens that
 * are about to expire get refreshed (and, critically for Constant Contact, the
 * ROTATED refresh token gets persisted) on a schedule instead of only when a
 * user-facing request happens to need one.
 *
 * A provider that was never connected is skipped quietly; a provider whose
 * refresh genuinely fails (revoked grant, network) makes the job fail so BullMQ
 * retries it — the other provider has already been attempted by then.
 */
export async function refreshTokensProcessor(): Promise<void> {
	const failed: string[] = [];

	for (const provider of PROVIDERS) {
		try {
			await getValidAccessToken(provider);
			log.debug({ provider }, "access token valid (refreshed if it was near expiry)");
		} catch (error) {
			if (isNotConnectedError(error)) {
				log.warn({ provider }, "provider not connected — skipping token refresh");
				continue;
			}
			log.error({ provider, err: error }, "token refresh failed");
			failed.push(provider);
		}
	}

	if (failed.length > 0) {
		throw new Error(`Token refresh failed for: ${failed.join(", ")}`);
	}
}
