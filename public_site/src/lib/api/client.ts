export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
	status: number;
	code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = code;
	}
}

interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	token?: string | null;
}

interface ErrorBody {
	error?: { code?: string; message?: string };
}

/**
 * The one place that talks to the backend. Matches the api's `HttpError` shape
 * (`{ error: { code, message } }`) exactly, so failures surface as a typed
 * `ApiError` instead of a generic fetch failure.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (options.token) headers.Authorization = `Bearer ${options.token}`;

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method: options.method ?? "GET",
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});

	const contentType = response.headers.get("content-type") ?? "";
	const payload = contentType.includes("application/json") ? await response.json() : undefined;

	if (!response.ok) {
		const errorBody = payload as ErrorBody | undefined;
		throw new ApiError(
			response.status,
			errorBody?.error?.code ?? "UNKNOWN_ERROR",
			errorBody?.error?.message ?? response.statusText,
		);
	}

	return payload as T;
}
