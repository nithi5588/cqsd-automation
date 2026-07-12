import { describe, expect, test } from "bun:test";
import { createApp } from "./app";

const app = createApp();

interface ErrorBody {
	error: { code: string; message: string };
}

describe("app", () => {
	test("unknown routes return a consistent 404 shape", async () => {
		const response = await app.request("/does-not-exist");
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
	});

	test("POST /auth/login with an invalid body returns a validation error, never touching the DB", async () => {
		const response = await app.request("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: "not-an-email" }),
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as ErrorBody;
		expect(body.error.code).toBe("VALIDATION_ERROR");
	});

	test("GET /connections without a bearer token is unauthorized", async () => {
		const response = await app.request("/connections");
		expect(response.status).toBe(401);
		const body = (await response.json()) as ErrorBody;
		expect(body.error.code).toBe("UNAUTHORIZED");
	});
});
