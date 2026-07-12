/** Resolved relative to this file, not the caller's cwd — works regardless of where `bun run` is invoked from. */
const COMPOSE_FILE = `${import.meta.dir}/../docker-compose.yml`;

async function run(args: string[]): Promise<void> {
	const proc = Bun.spawn(["docker", "compose", "-f", COMPOSE_FILE, ...args], {
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await proc.exited;
	if (code !== 0) {
		throw new Error(`docker compose ${args.join(" ")} exited with code ${code}`);
	}
}

export function dockerComposeUp(services: string[]): Promise<void> {
	return run(["up", "-d", ...services]);
}

export function dockerComposeDown(): Promise<void> {
	return run(["down"]);
}
