import { apiEnv } from "@cqsd/config";
import { type CampaignStat, type Prisma, type Webinar, prisma } from "@cqsd/db";
import { BadRequestError, ConflictError, NotFoundError, type PaginationParams } from "@cqsd/shared/http";
import { childLogger } from "@cqsd/shared/logger";
import { graphClient } from "../infrastructure/integrations";
import type {
	CreateWebinarInput,
	ImportAttendanceInput,
	PublicRegisterInput,
	UpdateWebinarInput,
} from "../validators/webinars.validator";

const log = childLogger("webinars");

const countInclude = { _count: { select: { registrations: true, attendances: true } } } as const;

type WebinarWithCounts = Webinar & { _count: { registrations: number; attendances: number } };

export function toWebinarListItem(webinar: WebinarWithCounts) {
	return {
		id: webinar.id,
		slug: webinar.slug,
		title: webinar.title,
		description: webinar.description,
		startsAt: webinar.startsAt,
		endsAt: webinar.endsAt,
		timeZone: webinar.timeZone,
		status: webinar.status,
		organizerUpn: webinar.organizerUpn,
		msWebinarId: webinar.msWebinarId,
		joinUrl: webinar.joinUrl,
		registrationUrl: webinar.registrationUrl,
		registrationCount: webinar._count.registrations,
		attendanceCount: webinar._count.attendances,
		createdAt: webinar.createdAt,
	};
}

export function mapCampaignStat(stat: CampaignStat) {
	return {
		sends: stat.sends,
		opens: stat.opens,
		uniqueOpens: stat.uniqueOpens,
		clicks: stat.clicks,
		uniqueClicks: stat.uniqueClicks,
		bounces: stat.bounces,
		optouts: stat.optouts,
		lastSyncedAt: stat.lastSyncedAt,
	};
}

function kebabCase(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const SLUG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSlugSuffix(length = 6): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let suffix = "";
	for (const byte of bytes) {
		suffix += SLUG_ALPHABET[byte % SLUG_ALPHABET.length];
	}
	return suffix;
}

function buildSlug(title: string): string {
	const base = kebabCase(title) || "webinar";
	return `${base}-${randomSlugSuffix()}`;
}

async function getWebinarOrThrow(id: string): Promise<Webinar> {
	const webinar = await prisma.webinar.findUnique({ where: { id } });
	if (!webinar) throw new NotFoundError("Webinar not found");
	return webinar;
}

export const WebinarsService = {
	async list(status: Webinar["status"] | undefined, pagination: PaginationParams) {
		const where: Prisma.WebinarWhereInput = status ? { status } : {};
		const [total, rows] = await Promise.all([
			prisma.webinar.count({ where }),
			prisma.webinar.findMany({
				where,
				orderBy: { startsAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
				include: countInclude,
			}),
		]);
		return {
			items: rows.map(toWebinarListItem),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async create(input: CreateWebinarInput) {
		const webinar = await prisma.webinar.create({
			data: {
				slug: buildSlug(input.title),
				title: input.title,
				description: input.description,
				startsAt: input.startsAt,
				endsAt: input.endsAt,
				timeZone: input.timeZone,
				organizerUpn: apiEnv.MS_ORGANIZER_UPN,
			},
			include: countInclude,
		});
		return toWebinarListItem(webinar);
	},

	async get(id: string) {
		const webinar = await prisma.webinar.findUnique({
			where: { id },
			include: {
				...countInclude,
				campaigns: {
					orderBy: { createdAt: "desc" },
					select: { id: true, name: true, status: true, volumeNumber: true, stat: true },
				},
			},
		});
		if (!webinar) throw new NotFoundError("Webinar not found");
		return {
			...toWebinarListItem(webinar),
			campaigns: webinar.campaigns.map((campaign) => ({
				id: campaign.id,
				name: campaign.name,
				status: campaign.status,
				volumeNumber: campaign.volumeNumber,
				stat: campaign.stat ? mapCampaignStat(campaign.stat) : null,
			})),
		};
	},

	async update(id: string, input: UpdateWebinarInput) {
		const existing = await getWebinarOrThrow(id);
		if (existing.status !== "DRAFT") {
			throw new ConflictError("Only draft webinars can be edited");
		}

		const startsAt = input.startsAt ?? existing.startsAt;
		const endsAt = input.endsAt ?? existing.endsAt;
		if (endsAt.getTime() <= startsAt.getTime()) {
			throw new BadRequestError("endsAt must be after startsAt");
		}

		const webinar = await prisma.webinar.update({
			where: { id },
			data: {
				title: input.title,
				description: input.description,
				startsAt: input.startsAt,
				endsAt: input.endsAt,
				timeZone: input.timeZone,
			},
			include: countInclude,
		});
		return toWebinarListItem(webinar);
	},

	async remove(id: string) {
		const existing = await getWebinarOrThrow(id);
		if (existing.status !== "DRAFT") {
			throw new ConflictError("Only draft webinars can be deleted");
		}
		await prisma.webinar.delete({ where: { id } });
	},

	async publish(id: string) {
		const webinar = await getWebinarOrThrow(id);
		if (webinar.status !== "DRAFT" || webinar.msWebinarId) {
			throw new ConflictError("Webinar is already published");
		}

		const { webinarId: msWebinarId } = await graphClient.createWebinarDraft({
			title: webinar.title,
			description: webinar.description ?? undefined,
			startIso: webinar.startsAt.toISOString(),
			endIso: webinar.endsAt.toISOString(),
			timeZone: webinar.timeZone,
			// Teams sends registration confirmations/reminders itself when enabled.
			attendeeEmailsEnabled: apiEnv.MS_TEAMS_ATTENDEE_EMAILS,
		});
		await graphClient.publishWebinar(msWebinarId);
		const sessions = await graphClient.getSessions(msWebinarId);
		const details = await graphClient.getWebinar(msWebinarId);

		const updated = await prisma.webinar.update({
			where: { id },
			data: {
				msWebinarId,
				msSessionId: sessions[0]?.sessionId ?? null,
				joinUrl: sessions[0]?.joinWebUrl ?? null,
				registrationUrl: details.registrationWebUrl,
				status: "PUBLISHED",
			},
			include: countInclude,
		});
		return toWebinarListItem(updated);
	},

	async registrations(id: string, pagination: PaginationParams) {
		await getWebinarOrThrow(id);
		const [total, rows] = await Promise.all([
			prisma.registration.count({ where: { webinarId: id } }),
			prisma.registration.findMany({
				where: { webinarId: id },
				orderBy: { registeredAt: "desc" },
				skip: pagination.skip,
				take: pagination.take,
			}),
		]);
		return {
			items: rows.map((row) => ({
				id: row.id,
				name: row.name,
				email: row.email,
				source: row.source,
				registeredAt: row.registeredAt,
				contactId: row.contactId,
				joinUrl: row.joinUrl,
			})),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	async attendance(id: string, pagination: PaginationParams) {
		await getWebinarOrThrow(id);
		const [total, registrationCount, attendedCount, durationAgg, rows] = await Promise.all([
			prisma.attendance.count({ where: { webinarId: id } }),
			prisma.registration.count({ where: { webinarId: id } }),
			prisma.attendance.count({ where: { webinarId: id, attended: true } }),
			prisma.attendance.aggregate({
				where: { webinarId: id },
				_avg: { durationSeconds: true },
			}),
			prisma.attendance.findMany({
				where: { webinarId: id },
				orderBy: [{ durationSeconds: "desc" }, { email: "asc" }],
				skip: pagination.skip,
				take: pagination.take,
				include: { contact: { select: { firstName: true, lastName: true } } },
			}),
		]);

		const registrationsForPage = rows.length
			? await prisma.registration.findMany({
					where: { webinarId: id, email: { in: rows.map((row) => row.email) } },
					select: { email: true, name: true },
				})
			: [];
		const registrationByEmail = new Map(
			registrationsForPage.map((registration) => [registration.email.toLowerCase(), registration.name]),
		);

		return {
			summary: {
				total,
				registrations: registrationCount,
				showRate: registrationCount > 0 ? attendedCount / registrationCount : 0,
				avgDurationSeconds: Math.round(durationAgg._avg.durationSeconds ?? 0),
			},
			items: rows.map((row) => {
				const registrationName = registrationByEmail.get(row.email.toLowerCase());
				return {
					id: row.id,
					email: row.email,
					name: row.contact
						? `${row.contact.firstName} ${row.contact.lastName}`.trim()
						: (registrationName ?? null),
					contactId: row.contactId,
					joinTime: row.joinTime,
					leaveTime: row.leaveTime,
					durationSeconds: row.durationSeconds,
					attended: row.attended,
					registered: registrationByEmail.has(row.email.toLowerCase()),
				};
			}),
			page: pagination.page,
			pageSize: pagination.pageSize,
			total,
		};
	},

	/**
	 * Manual attendance import from the CSV Teams lets organizers download.
	 * Fallback path when the Graph app-only permissions / Application Access
	 * Policy are not granted yet — fills the same tables the automatic sync
	 * does, so show rates and account plans keep working.
	 */
	async importAttendance(id: string, input: ImportAttendanceInput) {
		const webinar = await getWebinarOrThrow(id);

		let imported = 0;
		let matchedContacts = 0;
		for (const row of input.rows) {
			const email = row.email.toLowerCase();
			const contact = await prisma.contact.findUnique({ where: { email }, select: { id: true } });
			if (contact) matchedContacts += 1;

			const joinTime = row.joinTime ?? null;
			const leaveTime = row.leaveTime ?? null;
			const durationSeconds =
				row.durationSeconds ??
				(joinTime && leaveTime
					? Math.max(0, Math.round((leaveTime.getTime() - joinTime.getTime()) / 1000))
					: 0);

			await prisma.attendance.upsert({
				where: { webinarId_email: { webinarId: id, email } },
				create: {
					webinarId: id,
					email,
					contactId: contact?.id ?? null,
					joinTime,
					leaveTime,
					durationSeconds,
					attended: true,
				},
				update: {
					contactId: contact?.id ?? undefined,
					joinTime: joinTime ?? undefined,
					leaveTime: leaveTime ?? undefined,
					durationSeconds,
					attended: true,
				},
			});
			imported += 1;
		}

		if (webinar.endsAt.getTime() < Date.now() && webinar.status !== "COMPLETED") {
			await prisma.webinar.update({ where: { id }, data: { status: "COMPLETED" } });
		}

		return { imported, matchedContacts };
	},

	/**
	 * Public-safe webinar details for the website registration page. Exposes
	 * display fields only (never joinUrl / msWebinarId) and only for PUBLISHED
	 * webinars — everything else 404s so drafts stay invisible.
	 */
	async publicInfo(slug: string) {
		const webinar = await prisma.webinar.findUnique({ where: { slug } });
		if (!webinar || webinar.status !== "PUBLISHED") {
			throw new NotFoundError("Webinar not found");
		}
		return {
			slug: webinar.slug,
			title: webinar.title,
			description: webinar.description,
			startsAt: webinar.startsAt,
			endsAt: webinar.endsAt,
			timeZone: webinar.timeZone,
			status: webinar.status,
		};
	},

	async publicRegister(slug: string, input: PublicRegisterInput) {
		const webinar = await prisma.webinar.findUnique({ where: { slug } });
		if (!webinar || webinar.status !== "PUBLISHED") {
			throw new NotFoundError("Webinar not found");
		}

		const email = input.email.toLowerCase();
		const nameParts = input.name.trim().split(/\s+/);
		const firstName = nameParts[0] ?? "";
		const lastName = nameParts.slice(1).join(" ");

		let contact = await prisma.contact.findUnique({ where: { email } });
		if (!contact) {
			let orgId: string | undefined;
			if (input.company) {
				const existingOrg = await prisma.organization.findFirst({
					where: { name: { equals: input.company, mode: "insensitive" } },
				});
				orgId = existingOrg
					? existingOrg.id
					: (await prisma.organization.create({ data: { name: input.company } })).id;
			}
			// Upsert (update: {}) instead of create so a concurrent registration
			// for the same email cannot violate the unique constraint.
			contact = await prisma.contact.upsert({
				where: { email },
				update: {},
				create: { firstName, lastName, email, source: "WEBSITE", orgId },
			});
		}

		const registration = await prisma.registration.upsert({
			where: { webinarId_email: { webinarId: webinar.id, email } },
			update: { name: input.name.trim(), contactId: contact.id },
			create: {
				webinarId: webinar.id,
				contactId: contact.id,
				name: input.name.trim(),
				email,
				source: "WEBSITE",
			},
		});

		let joinUrl = registration.joinUrl;
		if (webinar.msWebinarId) {
			// Best-effort: local registration must succeed even when Graph is down
			// or the connection has not been configured yet.
			try {
				const result = await graphClient.createAnonymousRegistration(webinar.msWebinarId, {
					firstName,
					lastName: lastName || firstName,
					email,
				});
				joinUrl = result.joinUrl ?? joinUrl;
				await prisma.registration.update({
					where: { id: registration.id },
					data: {
						msRegistrationId: result.registrationId,
						joinUrl: result.joinUrl ?? undefined,
					},
				});
			} catch (error) {
				log.warn({ err: error, webinarId: webinar.id }, "Graph registration failed; kept local registration");
			}
		}

		return { ok: true, joinUrl: joinUrl ?? null };
	},
};
