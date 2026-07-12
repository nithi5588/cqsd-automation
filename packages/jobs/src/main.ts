import { createWorker } from "./worker";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is not set");
}

const worker = createWorker({
  queueName: "default",
  redisUrl,
  processor: async (job) => {
    console.log("processing job", job.id, job.name);
  },
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("jobs worker started");
