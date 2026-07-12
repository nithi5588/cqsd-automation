import { type Prisma, prisma } from "@cqsd/db";
import { childLogger } from "@cqsd/shared/logger";

const log = childLogger("audit");

/**
 * Fire-and-forget audit trail writer. Never throws: a failure to record an
 * audit entry must not break the user-facing operation it decorates.
 */
export async function audit(
	userId: string | null,
	action: string,
	entity: string,
	meta?: unknown,
): Promise<void> {
	try {
		await prisma.auditLog.create({
			data: {
				userId,
				action,
				entity,
				meta: meta === undefined ? undefined : (meta as Prisma.InputJsonValue),
			},
		});
	} catch (error) {
		log.warn({ err: error, action, entity }, "failed to write audit log entry");
	}
}
