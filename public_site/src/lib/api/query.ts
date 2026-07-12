/**
 * Builds a query string from a params object via URLSearchParams, skipping
 * undefined/null/empty-string values. Returns "" when nothing remains,
 * otherwise "?key=value&...".
 */
export function toQuery(
	params: Record<string, string | number | boolean | undefined | null>,
): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		search.set(key, String(value));
	}
	const qs = search.toString();
	return qs ? `?${qs}` : "";
}
