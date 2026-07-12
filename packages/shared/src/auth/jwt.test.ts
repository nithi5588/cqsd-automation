import { describe, expect, test } from "bun:test";
import { signAccessJwt, verifyAccessJwt } from "./jwt";

const baseOptions = {
	secret: "test-secret-at-least-16-chars",
	issuer: "cqsd-marketing-automation",
	audience: "cqsd-dashboard",
};

describe("access jwt", () => {
	test("verifies a token it signed", async () => {
		const token = await signAccessJwt({ ...baseOptions, userId: "user_1", email: "a@b.com", role: "ADMIN" });
		const claims = await verifyAccessJwt({ ...baseOptions, token });

		expect(claims.sub).toBe("user_1");
		expect(claims.email).toBe("a@b.com");
		expect(claims.role).toBe("ADMIN");
	});

	test("rejects a token signed with a different secret", async () => {
		const token = await signAccessJwt({ ...baseOptions, userId: "user_1", email: "a@b.com", role: "MEMBER" });
		await expect(
			verifyAccessJwt({ ...baseOptions, token, secret: "a-completely-different-secret!!" }),
		).rejects.toThrow();
	});

	test("rejects a token with the wrong audience", async () => {
		const token = await signAccessJwt({ ...baseOptions, userId: "user_1", email: "a@b.com", role: "MEMBER" });
		await expect(verifyAccessJwt({ ...baseOptions, token, audience: "some-other-app" })).rejects.toThrow(
			"Invalid token audience",
		);
	});
});
