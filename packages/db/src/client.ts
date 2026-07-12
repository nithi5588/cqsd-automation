import { PrismaClient } from "../generated/client";

declare global {
	// eslint-disable-next-line no-var
	var __cqsdPrisma: PrismaClient | undefined;
}

/**
 * Single shared Prisma client for the whole process. Reused across hot reloads in
 * dev so `bun --hot` doesn't open a new connection pool on every file change.
 */
export const prisma: PrismaClient = globalThis.__cqsdPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalThis.__cqsdPrisma = prisma;
}

export async function checkDatabaseHealth(): Promise<void> {
	await prisma.$queryRaw`SELECT 1`;
}
