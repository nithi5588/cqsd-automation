export function msAuthorizeUrl(tenantId: string): string {
	return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

export function msTokenUrl(tenantId: string): string {
	return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

export const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
