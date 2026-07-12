import { httpHealth, parseDatabaseUrl, parseRedisUrl, tcpHealth } from "../utils/http";
import { fail, ok, section } from "../utils/ui";

export async function status(): Promise<void> {
	section("Status");

	const db = parseDatabaseUrl();
	const dbUp = await tcpHealth(db.host, db.port, 1_500);
	(dbUp ? ok : fail)(`postgres (${db.host}:${db.port})`);

	const redis = parseRedisUrl();
	const redisUp = await tcpHealth(redis.host, redis.port, 1_500);
	(redisUp ? ok : fail)(`redis (${redis.host}:${redis.port})`);

	const apiHealthUrl = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/health`;
	const apiUp = await httpHealth(apiHealthUrl);
	(apiUp ? ok : fail)(`api (${apiHealthUrl})`);
}
