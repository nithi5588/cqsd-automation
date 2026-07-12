import { describe, expect, test } from "bun:test";
import { CC_HARD_BOUNCE_CODES, isHardBounce } from "./cc.types";

describe("isHardBounce", () => {
	test("flags every documented hard-bounce code, case-insensitively", () => {
		for (const code of CC_HARD_BOUNCE_CODES) {
			expect(isHardBounce(code)).toBe(true);
			expect(isHardBounce(code.toLowerCase())).toBe(true);
		}
	});

	test("ignores soft bounces and missing codes", () => {
		expect(isHardBounce("F")).toBe(false);
		expect(isHardBounce("")).toBe(false);
		expect(isHardBounce(null)).toBe(false);
		expect(isHardBounce(undefined)).toBe(false);
	});
});
