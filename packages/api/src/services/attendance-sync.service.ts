import { type Webinar, prisma } from "@cqsd/db";
import { BadRequestError, ExternalApiError, NotFoundError } from "@cqsd/shared/http";
import { childLogger } from "@cqsd/shared/logger";
import { graphClient } from "../infrastructure/integrations";

const log = childLogger("attendance-sync");

/** Seeded demo webinars carry fake msWebinarId values with this prefix (see packages/db/src/seed.ts). */
const SEED_ID_PREFIX = "seed-";

/**
 * Two-way registration sync for one published webinar:
 * 1. retries local registrations that never reached Teams (msRegistrationId null),
 * 2. pulls Teams-side registrants and upserts local `Registration` rows keyed
 *    on `[webinarId, email]`, matched to CRM contacts by lowercased email.
 * Returns the number of Teams-side registrant rows synced locally.
 */
async function syncWebinarRegistrations(webinarId: string, msWebinarId: string): Promise<number> {
	const local = await prisma.registration.findMany({
		where: { webinarId },
		select: { id: true, email: true, name: true, msRegistrationId: true },
	});
	const localByEmail = new Map(local.map((row) => [row.email.toLowerCase(), row]));

	// Retry pushes that failed at registration time (best-effort per row).
	for (const registration of local) {
		if (registration.msRegistrationId) continue;
		// Split the stored name the same way webinars.service publicRegister does.
		const nameParts = registration.name.trim().split(/\s+/);
		const firstName = nameParts[0] ?? "";
		const lastName = nameParts.slice(1).join(" ");
		try {
			const result = await graphClient.createAnonymousRegistration(msWebinarId, {
				firstName,
				lastName: lastName || firstName,
				email: registration.email.toLowerCase(),
			});
			await prisma.registration.update({
				where: { id: registration.id },
				data: { msRegistrationId: result.registrationId, joinUrl: result.joinUrl ?? undefined },
			});
			registration.msRegistrationId = result.registrationId;
		} catch (error) {
			log.warn(
				{ err: error, webinarId, registrationId: registration.id },
				"failed to push pending registration to Teams; will retry on next sync",
			);
		}
	}

	// Pull Teams-side registrants into local rows.
	const remote = await graphClient.listRegistrations(msWebinarId);
	const remoteEmails = [...new Set(remote.flatMap((row) => (row.email ? [row.email.toLowerCase()] : [])))];
	const contacts = remoteEmails.length
		? await prisma.contact.findMany({
				where: { email: { in: remoteEmails } },
				select: { id: true, email: true },
			})
		: [];
	const contactByEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c.id]));

	let synced = 0;
	for (const row of remote) {
		if (!row.email) continue;
		const email = row.email.toLowerCase();
		const existing = localByEmail.get(email);
		if (existing) {
			// Teams never overwrites local data — only backfill a missing Teams id.
			if (!existing.msRegistrationId && row.registrationId) {
				await prisma.registration.update({
					where: { id: existing.id },
					data: { msRegistrationId: row.registrationId },
				});
				existing.msRegistrationId = row.registrationId;
			}
		} else {
			const name =
				[row.firstName, row.lastName].filter(Boolean).join(" ").trim() || email.split("@")[0] || email;
			const registeredAt = row.registrationDateTime ? new Date(row.registrationDateTime) : null;
			const created = await prisma.registration.create({
				data: {
					webinarId,
					contactId: contactByEmail.get(email) ?? null,
					name,
					email,
					source: "TEAMS",
					msRegistrationId: row.registrationId || null,
					registeredAt: registeredAt && !Number.isNaN(registeredAt.getTime()) ? registeredAt : undefined,
				},
				select: { id: true, email: true, name: true, msRegistrationId: true },
			});
			localByEmail.set(email, created);
		}
		synced += 1;
	}
	return synced;
}

/**
 * Pulls Teams attendance reports for one webinar (when `webinarId` is given) or
 * for every published webinar that has already ended, and upserts local
 * `Attendance` rows keyed on `[webinarId, email]`. Attendees are matched back
 * to CRM contacts by lowercased email in a single batched lookup per webinar.
 * Registrations are synced with Teams (both directions) before each pull.
 */
export async function syncWebinarAttendance(
	webinarId?: string,
): Promise<{ synced: number; matchedContacts: number; registrationsSynced: number }> {
	const now = new Date();

	let targets: Webinar[];
	if (webinarId) {
		const webinar = await prisma.webinar.findUnique({ where: { id: webinarId } });
		if (!webinar) throw new NotFoundError("Webinar not found");
		targets = [webinar];
	} else {
		targets = await prisma.webinar.findMany({
			where: {
				status: "PUBLISHED",
				endsAt: { lt: now },
				msWebinarId: { not: null },
				// Seeded demo webinars carry fake webinar ids — never send those to Microsoft Graph.
				NOT: { msWebinarId: { startsWith: SEED_ID_PREFIX } },
			},
			orderBy: { endsAt: "asc" },
		});
	}

	let synced = 0;
	let registrationsSynced = 0;
	const matched = new Set<string>();

	for (const webinar of targets) {
		if (!webinar.msWebinarId) {
			if (webinarId) {
				throw new BadRequestError("Publish the webinar to Microsoft Teams before syncing attendance");
			}
			continue;
		}
		if (webinar.msWebinarId.startsWith(SEED_ID_PREFIX)) {
			if (webinarId) {
				throw new BadRequestError(
					"This is seeded demo data — create a real webinar to sync attendance from Microsoft Teams",
				);
			}
			continue;
		}

		// Sync registrations before the attendance pull so Teams-side registrants
		// exist locally. In batch mode a failure here logs and the webinar's
		// attendance sync still runs; in single-id mode it propagates.
		try {
			registrationsSynced += await syncWebinarRegistrations(webinar.id, webinar.msWebinarId);
		} catch (error) {
			if (webinarId) throw error;
			log.error(
				{ err: error, webinarId: webinar.id },
				"registration sync failed; continuing with attendance",
			);
		}

		let sessionId = webinar.msSessionId;
		if (!sessionId) {
			const sessions = await graphClient.getSessions(webinar.msWebinarId);
			sessionId = sessions[0]?.sessionId ?? null;
			if (sessionId) {
				await prisma.webinar.update({
					where: { id: webinar.id },
					data: { msSessionId: sessionId },
				});
			}
		}
		if (!sessionId) {
			if (webinarId) {
				throw new ExternalApiError("microsoft_graph", "No sessions found for this webinar");
			}
			log.warn({ webinarId: webinar.id }, "skipping attendance sync: webinar has no sessions");
			continue;
		}

		const records = await graphClient.getAttendanceRecords(webinar.msWebinarId, sessionId);

		const emails = [
			...new Set(records.flatMap((record) => (record.email ? [record.email.toLowerCase()] : []))),
		];
		const contacts = emails.length
			? await prisma.contact.findMany({
					where: { email: { in: emails } },
					select: { id: true, email: true },
				})
			: [];
		const contactByEmail = new Map(contacts.map((c) => [c.email.toLowerCase(), c.id]));

		for (const record of records) {
			if (!record.email) continue;
			const email = record.email.toLowerCase();
			const contactId = contactByEmail.get(email) ?? null;
			const durationSeconds = Math.max(0, Math.round(record.totalAttendanceInSeconds ?? 0));
			// Guard against the client's `recordId = email` fallback: that value is not
			// globally unique, and `msAttendanceRecordId` carries a unique constraint.
			const msAttendanceRecordId =
				record.recordId && record.recordId.toLowerCase() !== email ? record.recordId : null;
			const data = {
				contactId,
				joinTime: record.joinDateTime ? new Date(record.joinDateTime) : null,
				leaveTime: record.leaveDateTime ? new Date(record.leaveDateTime) : null,
				durationSeconds,
				attended: durationSeconds > 0,
			};

			await prisma.attendance.upsert({
				where: { webinarId_email: { webinarId: webinar.id, email } },
				update: { ...data, msAttendanceRecordId: msAttendanceRecordId ?? undefined },
				create: { webinarId: webinar.id, email, ...data, msAttendanceRecordId },
			});

			synced += 1;
			if (contactId) matched.add(contactId);
		}

		if (webinar.endsAt < now && records.length > 0 && webinar.status !== "COMPLETED") {
			await prisma.webinar.update({ where: { id: webinar.id }, data: { status: "COMPLETED" } });
		}

		log.info({ webinarId: webinar.id, records: records.length }, "attendance synced");
	}

	return { synced, matchedContacts: matched.size, registrationsSynced };
}
