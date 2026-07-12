// ============================================================
// Microsoft Graph (virtual events / webinars) — public shapes returned
// by GraphClient plus the raw wire payloads it parses (all-optional so
// every read is defensive against schema drift).
// ============================================================

export interface GraphCreateWebinarInput {
	title: string;
	description?: string;
	startIso: string;
	endIso: string;
	timeZone: string;
	/**
	 * Whether Teams emails attendees registration confirmations and reminders.
	 * Defaults to true when omitted — Teams keeps sending them unless the org
	 * explicitly turns this off.
	 */
	attendeeEmailsEnabled?: boolean;
}

export interface GraphWebinarSession {
	sessionId: string;
	joinWebUrl: string | null;
}

export interface GraphWebinarDetails {
	status: string | null;
	registrationWebUrl: string | null;
}

export interface GraphRegistrationInput {
	firstName: string;
	lastName: string;
	email: string;
}

export interface GraphRegistrationRow {
	registrationId: string;
	/** Lowercased when present so callers can match `Contact.email` directly. */
	email: string | null;
	firstName: string | null;
	lastName: string | null;
	status: string | null;
	registrationDateTime: string | null;
}

export interface GraphAttendanceRecord {
	recordId: string;
	/** Lowercased when present so callers can match `Contact.email` directly. */
	email: string | null;
	displayName: string | null;
	totalAttendanceInSeconds: number;
	joinDateTime: string | null;
	leaveDateTime: string | null;
}

// ------------------------------------------------------------
// Raw wire payloads (subset we read; everything optional).
// ------------------------------------------------------------

export interface GraphRawCollection<T> {
	value?: T[] | null;
	"@odata.nextLink"?: string | null;
}

export interface GraphRawSession {
	id?: string | null;
	joinWebUrl?: string | null;
}

export interface GraphRawRegistrationConfiguration {
	registrationWebUrl?: string | null;
}

export interface GraphRawWebinar {
	id?: string | null;
	status?: string | null;
	registrationConfiguration?: GraphRawRegistrationConfiguration | null;
	registrationWebUrl?: string | null;
	settings?: {
		registrationWebUrl?: string | null;
		registrationConfiguration?: GraphRawRegistrationConfiguration | null;
	} | null;
}

export interface GraphRawRegistration {
	id?: string | null;
	email?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	status?: string | null;
	registrationDateTime?: string | null;
	joinWebUrl?: string | null;
	joinUrl?: string | null;
}

export interface GraphRawAttendanceInterval {
	joinDateTime?: string | null;
	leaveDateTime?: string | null;
	durationInSeconds?: number | null;
}

export interface GraphRawAttendanceRecord {
	id?: string | null;
	emailAddress?: string | null;
	totalAttendanceInSeconds?: number | null;
	identity?: { displayName?: string | null } | null;
	attendanceIntervals?: Array<GraphRawAttendanceInterval | null> | null;
}

export interface GraphRawAttendanceReport {
	id?: string | null;
	meetingStartDateTime?: string | null;
	meetingEndDateTime?: string | null;
	attendanceRecords?: Array<GraphRawAttendanceRecord | null> | null;
}
