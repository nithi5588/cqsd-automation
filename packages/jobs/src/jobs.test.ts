import { describe, expect, test } from "bun:test";
import { createQueue } from "./queue";
import { createWorker } from "./worker";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

describe("bullmq wiring", () => {
	test("a queued job is picked up and processed by the worker", async () => {
		const queueName = `jobs-test-${crypto.randomUUID()}`;
		const queue = createQueue(queueName, REDIS_URL);
		const received: unknown[] = [];

		const worker = createWorker({
			queueName,
			redisUrl: REDIS_URL,
			processor: async (job) => {
				received.push(job.data);
			},
		});

		try {
			await queue.add("do-thing", { hello: "world" });

			await new Promise<void>((resolve, reject) => {
				worker.on("completed", () => resolve());
				worker.on("failed", (_job, error) => reject(error));
				setTimeout(() => reject(new Error("timed out waiting for job to complete")), 10_000);
			});

			expect(received).toEqual([{ hello: "world" }]);
		} finally {
			await worker.close();
			await queue.obliterate({ force: true });
			await queue.close();
		}
	}, 15_000);
});
