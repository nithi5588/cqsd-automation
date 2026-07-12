import { Queue, type QueueOptions } from "bullmq";
import { toConnectionOptions } from "./redis";

export type CreateQueueOptions = Partial<QueueOptions>;

/** A Queue with sane production defaults: capped exponential backoff and bounded job history. */
export function createQueue(name: string, redisUrl: string, options?: CreateQueueOptions): Queue {
	return new Queue(name, {
		connection: toConnectionOptions(redisUrl),
		defaultJobOptions: {
			attempts: 10,
			backoff: { type: "exponential", delay: 1_000 },
			removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
			removeOnFail: { age: 7 * 24 * 60 * 60 },
		},
		...options,
	});
}
