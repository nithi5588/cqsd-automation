import type { Job } from "@cqsd/jobs";
import { childLogger } from "@cqsd/shared/logger";
import { CcImportService } from "../../services/cc-import.service";

const log = childLogger("workers:import-constant-contact");

/**
 * One-shot, user-triggered pull of everything already in the connected Constant
 * Contact account. Runs as a background job — not inline in the HTTP request —
 * because a real account's contact/campaign history can take well past a single
 * request's lifetime to page through. The result is stored as the job's return
 * value; the Connections page polls GET .../import/:jobId to read it.
 */
export async function importConstantContactProcessor(job: Job) {
	const userId = typeof job.data?.userId === "string" ? job.data.userId : null;
	const result = await CcImportService.importAll(userId, (info) => {
		void job.updateProgress(info);
	});
	log.info({ userId, ...result }, "constant contact import completed");
	return result;
}
