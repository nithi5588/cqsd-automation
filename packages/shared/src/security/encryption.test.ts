import { describe, expect, test } from "bun:test";
import { decrypt, encrypt, generateEncryptionKey } from "./encryption";

describe("encryption", () => {
	test("round-trips plaintext through encrypt/decrypt", () => {
		const key = generateEncryptionKey();
		const plaintext = "super-secret-refresh-token";

		const ciphertext = encrypt(plaintext, key);
		expect(ciphertext).not.toBe(plaintext);
		expect(decrypt(ciphertext, key)).toBe(plaintext);
	});

	test("produces a different ciphertext each time (random IV)", () => {
		const key = generateEncryptionKey();
		expect(encrypt("same-value", key)).not.toBe(encrypt("same-value", key));
	});

	test("fails to decrypt with the wrong key", () => {
		const ciphertext = encrypt("hello", generateEncryptionKey());
		expect(() => decrypt(ciphertext, generateEncryptionKey())).toThrow();
	});

	test("rejects a key that isn't 32 bytes", () => {
		expect(() => encrypt("hello", Buffer.from("too-short").toString("base64"))).toThrow();
	});
});
