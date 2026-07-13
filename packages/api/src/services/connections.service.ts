import { NotFoundError } from "@cqsd/shared/http";
import { tokenStore } from "../infrastructure/integrations";
import { JOB_IMPORT_CONSTANT_CONTACT, jobsQueue } from "../workers";

export const ConnectionsService = {
	async getStatus() {
		const [constantContact, microsoft] = await Promise.all([
			tokenStore.status("CONSTANT_CONTACT"),
			tokenStore.status("MICROSOFT"),
		]);
		return { constantContact, microsoft };
	},

	/**
	 * Enqueues the Constant Contact import as a background job instead of running
	 * it inline — a real account's contact/campaign history can take well past a
	 * single HTTP request's lifetime to page through. Returns immediately with the
	 * job id; the caller polls `getImportStatus` for the result.
	 */
	async startConstantContactImport(userId: string | null) {
		const job = await jobsQueue.add(JOB_IMPORT_CONSTANT_CONTACT, { userId });
		if (!job.id) {
			throw new Error("Failed to enqueue Constant Contact import job");
		}
		return { jobId: job.id };
	},

	async getConstantContactImportStatus(jobId: string) {
		const job = await jobsQueue.getJob(jobId);
		if (!job) {
			throw new NotFoundError("Import job not found");
		}
		const state = await job.getState();
		if (state === "completed") {
			return { state, result: job.returnvalue };
		}
		if (state === "failed") {
			return { state, error: job.failedReason ?? "Import failed", attemptsMade: job.attemptsMade };
		}
		return { state, progress: job.progress ?? undefined };
	},
};
