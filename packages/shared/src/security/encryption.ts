import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function loadKey(base64Key: string): Buffer {
	const key = Buffer.from(base64Key, "base64");
	if (key.length !== 32) {
		throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes (a base64-encoded AES-256 key)");
	}
	return key;
}

/** Encrypts a string (e.g. an OAuth refresh token) with AES-256-GCM. Output is `base64(iv|tag|ciphertext)`. */
export function encrypt(plaintext: string, base64Key: string): string {
	const key = loadKey(base64Key);
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(payload: string, base64Key: string): string {
	const key = loadKey(base64Key);
	const raw = Buffer.from(payload, "base64");
	const iv = raw.subarray(0, IV_LENGTH);
	const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return plaintext.toString("utf8");
}

/** Generates a fresh base64 AES-256 key — run once to produce ENCRYPTION_KEY for `.env`. */
export function generateEncryptionKey(): string {
	return randomBytes(32).toString("base64");
}
