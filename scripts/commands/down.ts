import { dockerComposeDown } from "../utils/docker";
import { section } from "../utils/ui";

export async function down(): Promise<void> {
	section("Stopping local infrastructure");
	await dockerComposeDown();
}
