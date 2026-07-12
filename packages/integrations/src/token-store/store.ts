import { type OAuthProvider, prisma } from "@cqsd/db";
import { decrypt, encrypt } from "@cqsd/shared/security";
import type { ExchangedTokens } from "../types";

export interface SaveTokensInput extends ExchangedTokens {
	provider: OAuthProvider;
	accountIdentifier?: string;
}

export type ConnectionStatus =
	| { connected: false }
	| { connected: true; expiresAt: Date; scope: string; updatedAt: Date };

/**
 * The only place OAuth tokens are read or written. Tokens are encrypted at rest
 * (AES-256-GCM, see `@cqsd/shared/security`) and only ever decrypted in-process
 * right before use — never logged, never returned to the frontend.
 */
export class TokenStore {
	constructor(private readonly encryptionKey: string) {}

	async save(input: SaveTokensInput): Promise<void> {
		const accountIdentifier = input.accountIdentifier ?? "default";
		const accessTokenEnc = encrypt(input.accessToken, this.encryptionKey);
		const refreshTokenEnc = encrypt(input.refreshToken, this.encryptionKey);

		await prisma.oAuthConnection.upsert({
			where: { provider_accountIdentifier: { provider: input.provider, accountIdentifier } },
			update: { accessTokenEnc, refreshTokenEnc, expiresAt: input.expiresAt, scope: input.scope },
			create: {
				provider: input.provider,
				accountIdentifier,
				accessTokenEnc,
				refreshTokenEnc,
				expiresAt: input.expiresAt,
				scope: input.scope,
			},
		});
	}

	async get(provider: OAuthProvider, accountIdentifier = "default"): Promise<ExchangedTokens | null> {
		const row = await prisma.oAuthConnection.findUnique({
			where: { provider_accountIdentifier: { provider, accountIdentifier } },
		});
		if (!row) return null;

		return {
			accessToken: decrypt(row.accessTokenEnc, this.encryptionKey),
			refreshToken: decrypt(row.refreshTokenEnc, this.encryptionKey),
			expiresAt: row.expiresAt,
			scope: row.scope,
		};
	}

	async status(provider: OAuthProvider, accountIdentifier = "default"): Promise<ConnectionStatus> {
		const row = await prisma.oAuthConnection.findUnique({
			where: { provider_accountIdentifier: { provider, accountIdentifier } },
			select: { expiresAt: true, scope: true, updatedAt: true },
		});
		if (!row) return { connected: false };
		return { connected: true, expiresAt: row.expiresAt, scope: row.scope, updatedAt: row.updatedAt };
	}
}
