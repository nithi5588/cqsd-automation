import type { RedisOptions } from "ioredis";

/**
 * Converts a REDIS_URL into plain ioredis options rather than a shared client
 * instance. BullMQ Workers hold their connection open on a blocking read
 * (BRPOPLPUSH-style) — sharing one physical connection between a Queue and a
 * Worker would stall `.add()` calls while the Worker is blocked waiting for
 * jobs. Handing BullMQ plain options lets it create one dedicated client per
 * Queue/Worker instead, which is the pattern BullMQ itself recommends.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ on every connection a
 * Worker uses.
 */
export function toConnectionOptions(redisUrl: string): RedisOptions {
	const url = new URL(redisUrl);
	return {
		host: url.hostname,
		port: Number(url.port) || 6379,
		username: url.username || undefined,
		password: url.password || undefined,
		maxRetriesPerRequest: null,
	};
}
