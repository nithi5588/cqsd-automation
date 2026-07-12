import type { Job } from "@cqsd/jobs";
import { childLogger } from "@cqsd/shared/logger";
import { syncWebinarAttendance } from "../../services/attendance-sync.service";
import { isNotConnectedError } from "./errors";

const log = childLogger("workers:sync-attendance");

/**
 * Pulls Microsoft Teams attendance reports into `Attendance` rows (matched to
 * contacts by email). Accepts an optional `webinarId` in the job data for a
 * targeted sync; without one it syncs every PUBLISHED webinar that has ended.
 */
export async function syncAttendanceProcessor(job: Job): Promise<void> {
	const webinarId =
		typeof job.data?.webinarId === "string" && job.data.webinarId.length > 0 ? job.data.webinarId : undefined;

	try {
		const { synced, matchedContacts, registrationsSynced } = await syncWebinarAttendance(webinarId);
		log.info({ webinarId, synced, matchedContacts, registrationsSynced }, "webinar attendance synced");
	} catch (error) {
		if (isNotConnectedError(error)) {
			log.warn({ webinarId }, "Microsoft not connected — skipping attendance sync");
			return;
		}
		throw error;
	}
}
