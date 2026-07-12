import { prisma } from "@cqsd/db";
import type { PaginationParams } from "@cqsd/shared/http";

export const LeadsService = {
	async listImports(pagination: PaginationParams) {
		const [jobs, total] = await Promise.all([
			prisma.leadImportJob.findMany({
				orderBy: { createdAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
			}),
			prisma.leadImportJob.count(),
		]);

		return {
			items: jobs.map((job) => ({
				id: job.id,
				source: job.source,
				status: job.status,
				count: job.count,
				fileRef: job.fileRef,
				error: job.error,
				createdAt: job.createdAt,
			})),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},
};
