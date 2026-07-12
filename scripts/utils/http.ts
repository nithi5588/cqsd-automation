export interface HostPort {
	host: string;
	port: number;
}

function parseUrlEnv(envVar: string | undefined, fallback: HostPort): HostPort {
	if (!envVar) return fallback;

	try {
		const parsed = new URL(envVar);
		return { host: parsed.hostname, port: Number(parsed.port) || fallback.port };
	} catch {
		return fallback;
	}
}

/** Falls back to the docker-compose default (5433, chosen to avoid colliding with a local Postgres). */
export function parseDatabaseUrl(): HostPort {
	return parseUrlEnv(process.env.DATABASE_URL, { host: "localhost", port: 5433 });
}

export function parseRedisUrl(): HostPort {
	return parseUrlEnv(process.env.REDIS_URL, { host: "localhost", port: 6379 });
}

export async function tcpHealth(host: string, port: number, timeoutMs = 15_000): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const reachable = await new Promise<boolean>((resolve) => {
			Bun.connect({
				hostname: host,
				port,
				socket: {
					open(socket) {
						socket.end();
						resolve(true);
					},
					data() {},
					error() {
						resolve(false);
					},
				},
			}).catch(() => resolve(false));
		});

		if (reachable) return true;
		await Bun.sleep(300);
	}

	return false;
}

export async function httpHealth(url: string): Promise<boolean> {
	try {
		const response = await fetch(url);
		return response.ok;
	} catch {
		return false;
	}
}
