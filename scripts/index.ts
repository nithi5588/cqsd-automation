import { dev } from "./commands/dev";
import { down } from "./commands/down";
import { status } from "./commands/status";
import { up } from "./commands/up";

const COMMANDS: Record<string, () => Promise<void>> = { up, down, status, dev };

async function main(): Promise<void> {
	const [, , command] = process.argv;
	const handler = command ? COMMANDS[command] : undefined;

	if (!handler) {
		console.log(`Usage: bun scripts/index.ts <${Object.keys(COMMANDS).join("|")}>`);
		process.exit(command ? 1 : 0);
	}

	await handler();
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
