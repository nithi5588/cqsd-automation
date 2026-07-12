import type {
	AttendanceSyncResult,
	PageParams,
	Paginated,
	PublicRegistrationInput,
	PublicRegistrationResult,
	RegistrationRow,
	WebinarAccountPlan,
	WebinarAttendanceResponse,
	WebinarCreateInput,
	WebinarDetail,
	WebinarListItem,
	WebinarListParams,
	WebinarStatus,
	WebinarUpdateInput,
} from "@/types/domain";
import { apiRequest } from "./client";
import { toQuery } from "./query";

/** One attendee row parsed client-side from the Teams attendance CSV. */
export interface AttendanceImportRow {
	name?: string;
	email: string;
	joinTime?: string;
	leaveTime?: string;
	durationSeconds?: number;
}

/** Public-safe webinar details returned by `GET /public/webinars/:slug` (PUBLISHED only). */
export interface PublicWebinarInfo {
	slug: string;
	title: string;
	description: string | null;
	startsAt: string;
	endsAt: string;
	timeZone: string;
	status: WebinarStatus;
}

export const webinarsApi = {
	list(
		token: string | null,
		params: WebinarListParams = {},
	): Promise<Paginated<WebinarListItem>> {
		return apiRequest<Paginated<WebinarListItem>>(
			`/webinars${toQuery({
				status: params.status,
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	create(token: string | null, input: WebinarCreateInput): Promise<{ webinar: WebinarListItem }> {
		return apiRequest<{ webinar: WebinarListItem }>("/webinars", {
			method: "POST",
			body: input,
			token,
		});
	},

	get(token: string | null, id: string): Promise<{ webinar: WebinarDetail }> {
		return apiRequest<{ webinar: WebinarDetail }>(`/webinars/${id}`, { token });
	},

	update(
		token: string | null,
		id: string,
		input: WebinarUpdateInput,
	): Promise<{ webinar: WebinarListItem }> {
		return apiRequest<{ webinar: WebinarListItem }>(`/webinars/${id}`, {
			method: "PUT",
			body: input,
			token,
		});
	},

	remove(token: string | null, id: string): Promise<void> {
		return apiRequest<void>(`/webinars/${id}`, { method: "DELETE", token });
	},

	publish(token: string | null, id: string): Promise<{ webinar: WebinarListItem }> {
		return apiRequest<{ webinar: WebinarListItem }>(`/webinars/${id}/publish`, {
			method: "POST",
			token,
		});
	},

	registrations(
		token: string | null,
		id: string,
		params: PageParams = {},
	): Promise<Paginated<RegistrationRow>> {
		return apiRequest<Paginated<RegistrationRow>>(
			`/webinars/${id}/registrations${toQuery({
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	attendance(
		token: string | null,
		id: string,
		params: PageParams = {},
	): Promise<WebinarAttendanceResponse> {
		return apiRequest<WebinarAttendanceResponse>(
			`/webinars/${id}/attendance${toQuery({
				page: params.page,
				pageSize: params.pageSize,
			})}`,
			{ token },
		);
	},

	syncAttendance(token: string | null, id: string): Promise<AttendanceSyncResult> {
		return apiRequest<AttendanceSyncResult>(`/webinars/${id}/attendance/sync`, {
			method: "POST",
			token,
		});
	},

	/** Manual fallback: rows parsed from the attendance CSV downloaded from Teams. */
	importAttendance(
		token: string | null,
		id: string,
		rows: AttendanceImportRow[],
	): Promise<{ imported: number; matchedContacts: number }> {
		return apiRequest<{ imported: number; matchedContacts: number }>(
			`/webinars/${id}/attendance/import`,
			{ method: "POST", body: { rows }, token },
		);
	},

	accountPlan(token: string | null, id: string): Promise<WebinarAccountPlan> {
		return apiRequest<WebinarAccountPlan>(`/webinars/${id}/account-plan`, { token });
	},

	/** Public endpoint (no auth required) — details for the standalone registration page. */
	publicInfo(slug: string): Promise<{ webinar: PublicWebinarInfo }> {
		return apiRequest<{ webinar: PublicWebinarInfo }>(`/public/webinars/${slug}`);
	},

	/** Public endpoint (no auth required) — pass token as null. */
	register(
		token: string | null,
		slug: string,
		input: PublicRegistrationInput,
	): Promise<PublicRegistrationResult> {
		return apiRequest<PublicRegistrationResult>(`/public/webinars/${slug}/register`, {
			method: "POST",
			body: input,
			token,
		});
	},
};
