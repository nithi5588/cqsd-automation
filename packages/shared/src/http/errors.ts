import { ZodError } from "zod";

/**
 * Base class for every error we throw on purpose (as opposed to a bug throwing
 * an unexpected error). One root Hono `onError` handler (see `honoErrorHandler`
 * below) turns any `HttpError` into a consistent `{ error: { code, message } }`
 * body — services and controllers never call `ctx.json({ error }, status)` by hand.
 */
export class HttpError extends Error {
	readonly status: number;
	readonly code: string;
	readonly details?: unknown;

	constructor(status: number, code: string, message: string, details?: unknown) {
		super(message);
		this.name = "HttpError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

export class BadRequestError extends HttpError {
	constructor(message = "Bad request", details?: unknown) {
		super(400, "BAD_REQUEST", message, details);
	}
}

export class ValidationError extends HttpError {
	constructor(message = "Validation failed", details?: unknown) {
		super(400, "VALIDATION_ERROR", message, details);
	}
}

export class UnauthorizedError extends HttpError {
	constructor(message = "Unauthorized") {
		super(401, "UNAUTHORIZED", message);
	}
}

export class ForbiddenError extends HttpError {
	constructor(message = "Forbidden") {
		super(403, "FORBIDDEN", message);
	}
}

export class NotFoundError extends HttpError {
	constructor(message = "Not found") {
		super(404, "NOT_FOUND", message);
	}
}

export class ConflictError extends HttpError {
	constructor(message = "Conflict", details?: unknown) {
		super(409, "CONFLICT", message, details);
	}
}

/** Thrown when Constant Contact / Microsoft Graph return an error we can't recover from inline. */
export class ExternalApiError extends HttpError {
	constructor(provider: string, message: string, details?: unknown) {
		super(502, "EXTERNAL_API_ERROR", `${provider}: ${message}`, details);
	}
}

export interface ErrorResponseBody {
	error: { code: string; message: string; details?: unknown };
}

/** Maps any thrown value to an HTTP status + JSON body, never leaking internals in production. */
export function toErrorResponse(error: unknown): { status: number; body: ErrorResponseBody } {
	if (error instanceof HttpError) {
		return {
			status: error.status,
			body: { error: { code: error.code, message: error.message, details: error.details } },
		};
	}

	if (error instanceof ZodError) {
		return {
			status: 400,
			body: {
				error: {
					code: "VALIDATION_ERROR",
					message: "Validation failed",
					details: error.flatten(),
				},
			},
		};
	}

	const isProd = process.env.NODE_ENV === "production";
	return {
		status: 500,
		body: {
			error: {
				code: "INTERNAL_ERROR",
				message: isProd || !(error instanceof Error) ? "Internal server error" : error.message,
			},
		},
	};
}
