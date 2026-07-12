import { childLogger } from "@cqsd/shared/logger";
import { type Job, Worker, type WorkerOptions } from "bullmq";
import { toConnectionOptions } from "./redis";

export type JobProcessor = (job: Job) => Promise<void>;

export interface CreateWorkerOptions extends Partial<WorkerOptions> {
	queueName: string;
	redisUrl: string;
	processor: JobProcessor;
}

/** A Worker with the queue's own logger wired to its completed/failed/error events. */
export function createWorker(options: CreateWorkerOptions): Worker {
	const { queueName, redisUrl, processor, ...rest } = options;
	const log = childLogger(`jobs:${queueName}`);

	const worker = new Worker(queueName, processor, {
		connection: toConnectionOptions(redisUrl),
		...rest,
	});

	worker.on("completed", (job) => log.info({ jobId: job.id, name: job.name }, "job completed"));
	worker.on("failed", (job, error) =>
		log.error({ jobId: job?.id, name: job?.name, err: error }, "job failed"),
	);
	worker.on("error", (error) => log.error({ err: error }, "worker error"));

	return worker;
}
