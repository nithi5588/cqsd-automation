/** Result of any OAuth2 authorization-code or refresh-token exchange, before encryption. */
export interface ExchangedTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: Date;
	scope: string;
}
