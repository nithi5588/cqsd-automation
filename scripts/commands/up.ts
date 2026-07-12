import { dockerComposeUp } from "../utils/docker";
import { type HostPort, parseDatabaseUrl, parseRedisUrl, tcpHealth } from "../utils/http";
import { fail, info, ok, section } from "../utils/ui";

async function waitFor(label: string, target: HostPort): Promise<void> {
	info(`waiting for ${label} at ${target.host}:${target.port}...`);
	const reachable = await tcpHealth(target.host, target.port);

	if (reachable) {
		ok(`${label} is reachable at ${target.host}:${target.port}`);
	} else {
		fail(`${label} did not become reachable at ${target.host}:${target.port}`);
		process.exit(1);
	}
}

export async function up(): Promise<void> {
	section("Starting local infrastructure");
	await dockerComposeUp(["postgres", "redis"]);

	await waitFor("postgres", parseDatabaseUrl());
	await waitFor("redis", parseRedisUrl());
}
