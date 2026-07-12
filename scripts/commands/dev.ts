import { section } from "../utils/ui";
import { up } from "./up";

export async function dev(): Promise<void> {
	await up();

	section("Starting api + dashboard (turbo)");
	const proc = Bun.spawn(["bunx", "turbo", "run", "dev"], {
		stdout: "inherit",
		stderr: "inherit",
		stdin: "inherit",
	});

	const exitCode = await proc.exited;
	process.exit(exitCode);
}
