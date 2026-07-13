import { apiEnv } from "@cqsd/config";
import { type JobProcessor, createQueue, createWorker } from "@cqsd/jobs";
import { childLogger } from "@cqsd/shared/logger";
import { importConstantContactProcessor } from "./processors/import-constant-contact";
import { refreshTokensProcessor } from "./processors/refresh-tokens";
import { syncAttendanceProcessor } from "./processors/sync-attendance";
import { syncCampaignStatsProcessor } from "./processors/sync-campaign-stats";

const QUEUE_NAME = "cqsd-jobs";

/**
 * The BullMQ queue every part of the api enqueues background work onto (token
 * refresh, campaign-stat sync, attendance sync, ...) — processed in-process by
 * this same server rather than a separate cc-sync/teams-sync deployable. Split
 * a job type out into its own worker service later only if it genuinely needs
 * independent scaling or restart cadence.
 */
export const jobsQueue = createQueue(QUEUE_NAME, apiEnv.REDIS_URL);

export const JOB_SYNC_CAMPAIGN_STATS = "sync-campaign-stats";
export const JOB_SYNC_ATTENDANCE = "sync-attendance";
export const JOB_REFRESH_TOKENS = "refresh-tokens";
/** One-shot, user-triggered — never added to REPEATABLE_JOBS below. */
export const JOB_IMPORT_CONSTANT_CONTACT = "import-constant-contact";

/**
 * Job name -> processor. Populated at module load — i.e. strictly before
 * `startWorkers()` can run — so the worker knows every job type from its first poll.
 */
const processors: Record<string, JobProcessor> = {
	[JOB_SYNC_CAMPAIGN_STATS]: syncCampaignStatsProcessor,
	[JOB_SYNC_ATTENDANCE]: syncAttendanceProcessor,
	[JOB_REFRESH_TOKENS]: refreshTokensProcessor,
	[JOB_IMPORT_CONSTANT_CONTACT]: importConstantContactProcessor,
};

/** Repeatable schedules; the scheduler id doubles as the job name. `every` is milliseconds. */
const REPEATABLE_JOBS = [
	{ id: JOB_SYNC_CAMPAIGN_STATS, every: 10 * 60_000 },
	{ id: JOB_SYNC_ATTENDANCE, every: 60 * 60_000 },
	{ id: JOB_REFRESH_TOKENS, every: 30 * 60_000 },
] as const;

/**
 * Starts the in-process worker and (best-effort) registers the repeatable job
 * schedulers. Never throws: a down Redis in dev logs a warning and disables
 * background sync instead of crashing the API.
 */
export function startWorkers(): void {
	const log = childLogger("workers");

	createWorker({
		queueName: QUEUE_NAME,
		redisUrl: apiEnv.REDIS_URL,
		processor: async (job) => {
			const handler = processors[job.name];
			if (!handler) throw new Error(`No processor registered for job "${job.name}"`);
			// Propagate whatever the handler resolves to — BullMQ stores it as
			// job.returnvalue, which is how the import job's caller reads its result.
			return await handler(job);
		},
	});
	log.info({ jobs: Object.keys(processors) }, "job worker started");

	void registerRepeatableJobs(log);
}

async function registerRepeatableJobs(log: ReturnType<typeof childLogger>): Promise<void> {
	// With `maxRetriesPerRequest: null` a down Redis makes BullMQ buffer commands
	// forever rather than reject, so surface a warning if scheduling stalls; the
	// upserts still complete on their own if Redis comes back later.
	const stallWarning = setTimeout(() => {
		log.warn("repeatable job scheduling has not completed after 15s — is Redis reachable?");
	}, 15_000);

	try {
		await Promise.all(
			REPEATABLE_JOBS.map(({ id, every }) =>
				jobsQueue.upsertJobScheduler(id, { every }, { name: id, data: {} }),
			),
		);
		log.info(
			{ schedules: REPEATABLE_JOBS.map(({ id, every }) => `${id} every ${every / 60_000}m`) },
			"repeatable jobs scheduled",
		);
	} catch (error) {
		log.warn(
			{ err: error },
			"failed to schedule repeatable jobs — Redis may be down; background sync disabled",
		);
	} finally {
		clearTimeout(stallWarning);
	}
}
