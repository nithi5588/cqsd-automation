import type { Job } from "@cqsd/jobs";
import { childLogger } from "@cqsd/shared/logger";
import { syncCampaignStats } from "../../services/campaign-sync.service";
import { isNotConnectedError } from "./errors";

const log = childLogger("workers:sync-campaign-stats");

/**
 * Pulls Constant Contact tracking data (aggregate stats + per-contact opens/clicks/
 * bounces) into `CampaignStat` / `ContactCampaignActivity`. Accepts an optional
 * `campaignId` in the job data for a targeted sync; without one it syncs every
 * campaign that has been pushed to Constant Contact (status SCHEDULED/SENDING/SENT).
 */
export async function syncCampaignStatsProcessor(job: Job): Promise<void> {
	const campaignId =
		typeof job.data?.campaignId === "string" && job.data.campaignId.length > 0
			? job.data.campaignId
			: undefined;

	try {
		const { syncedCampaigns } = await syncCampaignStats(campaignId);
		log.info({ campaignId, syncedCampaigns }, "campaign stats synced");
	} catch (error) {
		if (isNotConnectedError(error)) {
			log.warn({ campaignId }, "Constant Contact not connected — skipping campaign stats sync");
			return;
		}
		throw error;
	}
}
