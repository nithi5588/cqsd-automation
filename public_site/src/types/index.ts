export type UserRole = "ADMIN" | "MEMBER";

export interface User {
	id: string;
	email: string;
	role: UserRole;
}

export interface LoginResult {
	token: string;
	user: User;
}

export type OAuthProviderKey = "constantContact" | "microsoft";

export type ProviderConnectionStatus =
	| { connected: false }
	| { connected: true; expiresAt: string; scope: string; updatedAt: string };

export interface ConnectionsStatus {
	constantContact: ProviderConnectionStatus;
	microsoft: ProviderConnectionStatus;
}
