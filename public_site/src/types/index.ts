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

export interface CcImportResult {
	segments: { listsImported: number; dynamicSegmentsImported: number; dynamicSegmentMemberships: number };
	contacts: { created: number; updated: number; segmentMemberships: number };
	campaigns: { created: number; updated: number; skipped: number };
	statsSynced: number;
}

/** Polled state of a background Constant Contact import job. */
export interface CcImportJobStatus {
	state: string;
	result?: CcImportResult;
	error?: string;
	progress?: { phase: string; completed: number; total: number };
}

/** Live read-only Constant Contact account info (Account Services API). */
export interface CcAccountInfo {
	organizationName: string | null;
	accountName: string | null;
	timeZone: string | null;
	countryCode: string | null;
}
