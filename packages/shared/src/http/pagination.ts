export interface PaginationParams {
	page: number;
	pageSize: number;
	skip: number;
	take: number;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 200;

/** Parses `?page=&pageSize=` query params into safe, bounded pagination params. */
export function parsePagination(query: { page?: string; pageSize?: string }): PaginationParams {
	const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
	const pageSize = Math.min(
		MAX_PAGE_SIZE,
		Math.max(1, Number.parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
	);

	return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
