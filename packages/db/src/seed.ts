import { prisma } from "./client";

// ============================================================
// Deterministic helpers
// ============================================================

/**
 * Pure hash-style PRNG: the same inputs always produce the same 0..1 value,
 * across runs and machines, so re-seeding never reshuffles the sample data.
 * (Math.random()/Date.now() must never be used for data values here — the
 * upserts below rely on values being stable between runs.)
 */
function seededRandom(...parts: number[]): number {
	let state = 0x9e3779b9;
	for (const part of parts) {
		state = (state ^ Math.imul(part + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
		state = Math.imul(state ^ (state >>> 13), 0xc2b2ae35) >>> 0;
		state = (state ^ (state >>> 16)) >>> 0;
	}
	return state / 4_294_967_296;
}

function pick<T>(pool: readonly T[], ...seedParts: number[]): T {
	return pool[Math.floor(seededRandom(...seedParts) * pool.length)] as T;
}

/** One wall-clock reference per run so every relative date agrees with the others. */
const NOW = new Date();

/** `days` may be negative. Times are pinned to fixed UTC clock values for stability within a run. */
function daysFromNow(days: number, hourUtc = 9, minuteUtc = 0): Date {
	const d = new Date(NOW);
	d.setUTCDate(d.getUTCDate() + days);
	d.setUTCHours(hourUtc, minuteUtc, 0, 0);
	return d;
}

function pad(n: number): string {
	return String(n).padStart(3, "0");
}

function sampleHtml(headline: string, body: string, ctaLabel: string, ctaUrl: string): string {
	return `<!doctype html>
<html>
	<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:'Segoe UI',Arial,sans-serif;">
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
			<tr>
				<td align="center" style="padding:32px 16px;">
					<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
						<tr>
							<td style="background-color:#0f2a43;padding:28px 32px;">
								<p style="margin:0;color:#7dd3fc;font-size:12px;letter-spacing:2px;text-transform:uppercase;">CompQsoft Digital</p>
								<h1 style="margin:8px 0 0;color:#ffffff;font-size:24px;line-height:1.3;">${headline}</h1>
							</td>
						</tr>
						<tr>
							<td style="padding:28px 32px;color:#334155;font-size:15px;line-height:1.6;">
								<p style="margin:0 0 20px;">${body}</p>
								<a href="${ctaUrl}" style="display:inline-block;background-color:#0ea5e9;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">${ctaLabel}</a>
							</td>
						</tr>
						<tr>
							<td style="padding:20px 32px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
								CompQsoft Digital &middot; Houston, TX &middot; <a href="{{unsubscribe}}" style="color:#94a3b8;">Unsubscribe</a>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;
}

// ============================================================
// Sample-data definitions
// ============================================================

const ORG_DEFS = [
	{
		name: "Northwind Health Partners",
		industry: "Healthcare",
		aeOwner: "Greg",
		revenue: 42_500_000,
		domain: "northwindhealth",
	},
	{
		name: "Pinnacle Medical Systems",
		industry: "Healthcare",
		aeOwner: "Amy",
		revenue: 33_750_000,
		domain: "pinnaclemedical",
	},
	{
		name: "Cascade Manufacturing Group",
		industry: "Manufacturing",
		aeOwner: "John",
		revenue: 118_000_000,
		domain: "cascademfg",
	},
	{
		name: "Ironclad Industrial Works",
		industry: "Manufacturing",
		aeOwner: "Greg",
		revenue: 91_250_000,
		domain: "ironcladworks",
	},
	{
		name: "Sterling Mutual Finance",
		industry: "Finance",
		aeOwner: "Amy",
		revenue: 260_000_000,
		domain: "sterlingmutual",
	},
	{
		name: "Beacon Capital Advisors",
		industry: "Finance",
		aeOwner: "John",
		revenue: 145_500_000,
		domain: "beaconcapital",
	},
	{
		name: "Harborview Retail Co",
		industry: "Retail",
		aeOwner: "Greg",
		revenue: 75_000_000,
		domain: "harborviewretail",
	},
	{
		name: "BlueRidge Logistics",
		industry: "Logistics",
		aeOwner: "John",
		revenue: 54_250_000,
		domain: "blueridgelogistics",
	},
] as const;

const FIRST_NAMES = [
	"Sarah",
	"Michael",
	"Priya",
	"David",
	"Elena",
	"James",
	"Aisha",
	"Robert",
	"Mei",
	"Carlos",
] as const;

const LAST_NAMES = ["Mitchell", "Okafor", "Nguyen", "Petersen", "Ramirez"] as const;

type SeedPersona = "IT" | "LINE_OF_BUSINESS" | "CUSTOMER_SERVICE" | null;

/** i % 7 → persona; index 6 leaves persona unknown on purpose. */
const PERSONA_CYCLE: readonly SeedPersona[] = [
	"IT",
	"IT",
	"LINE_OF_BUSINESS",
	"LINE_OF_BUSINESS",
	"CUSTOMER_SERVICE",
	"CUSTOMER_SERVICE",
	null,
];

const TITLES: Record<string, readonly string[]> = {
	IT: ["CIO", "IT Director", "VP of Infrastructure", "Head of IT Operations", "Systems Architect"],
	LINE_OF_BUSINESS: [
		"VP of Operations",
		"Director of Strategy",
		"General Manager",
		"COO",
		"Head of Digital Transformation",
	],
	CUSTOMER_SERVICE: [
		"VP of Customer Service",
		"Director of Support",
		"Customer Experience Manager",
		"Head of Contact Center",
		"Support Operations Lead",
	],
	NONE: ["Business Analyst", "Program Manager", "Operations Coordinator"],
};

const CONTACT_COUNT = 50;

interface SeededOrg {
	id: string;
	name: string;
	industry: string;
	aeOwner: string;
	domain: string;
}

interface SeededContact {
	id: string;
	index: number;
	orgIndex: number;
	firstName: string;
	lastName: string;
	email: string;
	persona: SeedPersona;
}

interface SeededSegment {
	id: string;
	name: string;
}

interface SeededWebinar {
	id: string;
	title: string;
	startsAt: Date;
	endsAt: Date;
	joinUrl: string | null;
}

interface SeededCampaign {
	id: string;
	name: string;
}

// ============================================================
// Seed steps
// ============================================================

async function seedAdmin(): Promise<{ id: string; email: string }> {
	const email = process.env.SEED_ADMIN_EMAIL ?? "admin@cqsddigital.com";
	const password = process.env.SEED_ADMIN_PASSWORD ?? crypto.randomUUID();

	const passwordHash = await Bun.password.hash(password, {
		algorithm: "argon2id",
		memoryCost: 19_456,
		timeCost: 2,
	});

	const user = await prisma.user.upsert({
		where: { email },
		update: { passwordHash, role: "ADMIN" },
		create: { email, passwordHash, role: "ADMIN" },
	});

	console.log(`[seed] admin user ready: ${user.email}`);
	if (!process.env.SEED_ADMIN_PASSWORD) {
		console.log(`[seed] generated password (save this now): ${password}`);
	}
	return { id: user.id, email: user.email };
}

async function seedOrganizations(): Promise<SeededOrg[]> {
	const orgs: SeededOrg[] = [];
	for (const def of ORG_DEFS) {
		const existing = await prisma.organization.findFirst({ where: { name: def.name } });
		const org = existing
			? await prisma.organization.update({
					where: { id: existing.id },
					data: { industry: def.industry, revenue: def.revenue, aeOwner: def.aeOwner },
				})
			: await prisma.organization.create({
					data: {
						name: def.name,
						industry: def.industry,
						revenue: def.revenue,
						aeOwner: def.aeOwner,
					},
				});
		orgs.push({
			id: org.id,
			name: def.name,
			industry: def.industry,
			aeOwner: def.aeOwner,
			domain: def.domain,
		});
	}
	return orgs;
}

async function seedContacts(orgs: SeededOrg[]): Promise<SeededContact[]> {
	const contacts: SeededContact[] = [];

	for (let i = 0; i < CONTACT_COUNT; i++) {
		const firstName = FIRST_NAMES[i % FIRST_NAMES.length] as string;
		const lastName = LAST_NAMES[Math.floor(i / FIRST_NAMES.length)] as string;
		const orgIndex = i % orgs.length;
		const org = orgs[orgIndex] as SeededOrg;
		const email = `${firstName}.${lastName}@${org.domain}.example`.toLowerCase();
		const persona = PERSONA_CYCLE[i % PERSONA_CYCLE.length] as SeedPersona;
		const title = pick(TITLES[persona ?? "NONE"] as readonly string[], 1, i);
		// Leave industry blank on a fifth of contacts — segment matching then relies on the org.
		const industry = i % 5 === 4 ? null : org.industry;
		const sourceRoll = seededRandom(2, i);
		const source =
			sourceRoll < 0.35
				? "CSV_IMPORT"
				: sourceRoll < 0.65
					? "LEADGEN"
					: sourceRoll < 0.85
						? "MANUAL"
						: "WEBSITE";
		const ccContactId = i % 4 === 0 ? `seed-cc-contact-${pad(i + 1)}` : null;

		const data = {
			firstName,
			lastName,
			title,
			industry,
			persona,
			source,
			orgId: org.id,
			ccContactId,
		} as const;

		const contact = await prisma.contact.upsert({
			where: { email },
			update: data,
			create: { email, ...data },
		});

		contacts.push({ id: contact.id, index: i, orgIndex, firstName, lastName, email, persona });
	}

	return contacts;
}

async function seedSegments(
	orgs: SeededOrg[],
	contacts: SeededContact[],
): Promise<{ healthcare: SeededSegment; gregBook: SeededSegment; itLeaders: SeededSegment }> {
	const healthcareOrgIndexes = orgs.flatMap((org, idx) => (org.industry === "Healthcare" ? [idx] : []));
	const gregOrgIndexes = orgs.flatMap((org, idx) => (org.aeOwner === "Greg" ? [idx] : []));

	const defs = [
		{
			name: "Healthcare Accounts",
			type: "INDUSTRY" as const,
			criteria: { industry: "Healthcare" },
			ccSegmentId: "seed-cc-list-healthcare",
			members: contacts.filter((c) => healthcareOrgIndexes.includes(c.orgIndex)),
		},
		{
			name: "Greg's Book of Business",
			type: "AE" as const,
			criteria: { aeOwner: "Greg" },
			ccSegmentId: "seed-cc-list-greg",
			members: contacts.filter((c) => gregOrgIndexes.includes(c.orgIndex)),
		},
		{
			name: "IT Decision Makers",
			type: "PERSONA" as const,
			criteria: { persona: "IT" },
			ccSegmentId: null,
			members: contacts.filter((c) => c.persona === "IT"),
		},
	];

	const seeded: SeededSegment[] = [];
	for (const def of defs) {
		const existing = await prisma.segment.findFirst({ where: { name: def.name } });
		const segment = existing
			? await prisma.segment.update({
					where: { id: existing.id },
					data: { type: def.type, criteriaJson: def.criteria, ccSegmentId: def.ccSegmentId },
				})
			: await prisma.segment.create({
					data: {
						name: def.name,
						type: def.type,
						criteriaJson: def.criteria,
						ccSegmentId: def.ccSegmentId,
					},
				});

		await prisma.segmentMember.createMany({
			data: def.members.map((member) => ({ segmentId: segment.id, contactId: member.id })),
			skipDuplicates: true,
		});

		seeded.push({ id: segment.id, name: def.name });
	}

	return {
		healthcare: seeded[0] as SeededSegment,
		gregBook: seeded[1] as SeededSegment,
		itLeaders: seeded[2] as SeededSegment,
	};
}

async function seedWebinars(): Promise<{
	completed: SeededWebinar;
	published: SeededWebinar;
	draft: SeededWebinar;
}> {
	const organizerUpn = process.env.MS_ORGANIZER_UPN ?? "events@cqsddigital.com";

	const defs = [
		{
			slug: "ai-in-customer-service-hype-to-roi",
			title: "AI in Customer Service: From Hype to ROI",
			description:
				"A practical look at where AI actually pays off in the contact center — deflection, agent assist, and quality scoring — with benchmarks from live deployments.",
			startsAt: daysFromNow(-7, 16),
			endsAt: daysFromNow(-7, 17),
			status: "COMPLETED" as const,
			msWebinarId: "seed-ms-webinar-001",
			msSessionId: "seed-ms-session-001",
			joinUrl: "https://teams.microsoft.com/l/meetup-join/seed-webinar-001",
			registrationUrl: "https://events.teams.microsoft.com/event/seed-webinar-001",
		},
		{
			slug: "modernizing-the-contact-center",
			title: "Modernizing the Contact Center with Microsoft Teams",
			description:
				"How mid-market operations teams are consolidating telephony, chat, and CRM screens into Teams — including a live migration walkthrough.",
			startsAt: daysFromNow(7, 16),
			endsAt: daysFromNow(7, 17),
			status: "PUBLISHED" as const,
			msWebinarId: "seed-ms-webinar-002",
			msSessionId: "seed-ms-session-002",
			joinUrl: "https://teams.microsoft.com/l/meetup-join/seed-webinar-002",
			registrationUrl: "https://events.teams.microsoft.com/event/seed-webinar-002",
		},
		{
			slug: "scaling-secure-infrastructure",
			title: "Scaling Secure Infrastructure for Regulated Industries",
			description:
				"Zero-trust patterns, compliance guardrails, and cost controls for healthcare and finance workloads.",
			startsAt: daysFromNow(21, 15),
			endsAt: daysFromNow(21, 16),
			status: "DRAFT" as const,
			msWebinarId: null,
			msSessionId: null,
			joinUrl: null,
			registrationUrl: null,
		},
	];

	const seeded: SeededWebinar[] = [];
	for (const def of defs) {
		const data = {
			title: def.title,
			description: def.description,
			startsAt: def.startsAt,
			endsAt: def.endsAt,
			timeZone: "America/Chicago",
			organizerUpn,
			status: def.status,
			msWebinarId: def.msWebinarId,
			msSessionId: def.msSessionId,
			joinUrl: def.joinUrl,
			registrationUrl: def.registrationUrl,
		};
		const webinar = await prisma.webinar.upsert({
			where: { slug: def.slug },
			update: data,
			create: { slug: def.slug, ...data },
		});
		seeded.push({
			id: webinar.id,
			title: def.title,
			startsAt: def.startsAt,
			endsAt: def.endsAt,
			joinUrl: def.joinUrl,
		});
	}

	return {
		completed: seeded[0] as SeededWebinar,
		published: seeded[1] as SeededWebinar,
		draft: seeded[2] as SeededWebinar,
	};
}

interface CampaignSeedDef {
	name: string;
	subject: string;
	volumeNumber: number | null;
	status: "DRAFT" | "SCHEDULED" | "SENT";
	scheduledAt: Date | null;
	webinarId: string | null;
	segmentId: string | null;
	ccCampaignId: string | null;
	ccActivityId: string | null;
	htmlContent: string;
	/** Contacts that received the campaign — drives activity rows + stats for SENT campaigns. */
	targets: SeededContact[];
	/** Distinct per-campaign seed so open/click patterns differ between volumes. */
	statSeed: number;
}

async function seedCampaigns(
	webinars: { completed: SeededWebinar; published: SeededWebinar },
	segments: { healthcare: SeededSegment; gregBook: SeededSegment; itLeaders: SeededSegment },
	contacts: SeededContact[],
): Promise<SeededCampaign[]> {
	const healthcareTargets = contacts.filter((c) => c.orgIndex === 0 || c.orgIndex === 1);
	const fromName = "CQSD Digital";
	const fromEmail = "marketing@cqsddigital.com";
	const replyTo = "hello@cqsddigital.com";
	const webinarCtaUrl = "https://events.teams.microsoft.com/event/seed-webinar-001";

	const defs: CampaignSeedDef[] = [
		{
			name: "AI in CS Webinar — Invite (Vol 1)",
			subject: "You're invited: AI in Customer Service — From Hype to ROI",
			volumeNumber: 1,
			status: "SENT",
			scheduledAt: daysFromNow(-14, 14),
			webinarId: webinars.completed.id,
			segmentId: segments.healthcare.id,
			ccCampaignId: "seed-cc-campaign-001",
			ccActivityId: "seed-cc-activity-001",
			htmlContent: sampleHtml(
				"AI in Customer Service: From Hype to ROI",
				"Join us for a 60-minute session on where AI genuinely moves the needle in the contact center — with real deflection and CSAT numbers from live deployments.",
				"Save my seat",
				webinarCtaUrl,
			),
			targets: healthcareTargets,
			statSeed: 1,
		},
		{
			name: "AI in CS Webinar — Reminder (Vol 2)",
			subject: "One week out: AI in Customer Service — From Hype to ROI",
			volumeNumber: 2,
			status: "SENT",
			scheduledAt: daysFromNow(-10, 14),
			webinarId: webinars.completed.id,
			segmentId: segments.healthcare.id,
			ccCampaignId: "seed-cc-campaign-002",
			ccActivityId: "seed-cc-activity-002",
			htmlContent: sampleHtml(
				"One week to go",
				"Seats are filling up for our AI in Customer Service session. Reserve yours now and get the benchmark deck even if you can't attend live.",
				"Register now",
				webinarCtaUrl,
			),
			targets: healthcareTargets,
			statSeed: 2,
		},
		{
			name: "AI in CS Webinar — Last Chance (Vol 3)",
			subject: "Last chance to register: AI in Customer Service",
			volumeNumber: 3,
			status: "SENT",
			scheduledAt: daysFromNow(-8, 14),
			webinarId: webinars.completed.id,
			segmentId: segments.healthcare.id,
			ccCampaignId: "seed-cc-campaign-003",
			ccActivityId: "seed-cc-activity-003",
			htmlContent: sampleHtml(
				"Doors close tomorrow",
				"This is the final call for AI in Customer Service: From Hype to ROI. Grab one of the remaining seats before registration closes.",
				"Claim my seat",
				webinarCtaUrl,
			),
			targets: healthcareTargets,
			statSeed: 3,
		},
		{
			name: "Q3 Pipeline Newsletter — Greg's Accounts",
			subject: "Q3 field notes: what your peers are shipping this quarter",
			volumeNumber: null,
			status: "SCHEDULED",
			scheduledAt: daysFromNow(3, 15),
			webinarId: null,
			segmentId: segments.gregBook.id,
			ccCampaignId: "seed-cc-campaign-004",
			ccActivityId: "seed-cc-activity-004",
			htmlContent: sampleHtml(
				"Q3 field notes",
				"Three modernization projects our customers shipped last quarter — and the playbooks behind them. A five-minute read curated for your account team.",
				"Read the field notes",
				"https://cqsddigital.example/field-notes/q3",
			),
			targets: [],
			statSeed: 4,
		},
		{
			name: "Modernizing the Contact Center — Invite (Vol 1)",
			subject: "You're invited: Modernizing the Contact Center with Microsoft Teams",
			volumeNumber: 1,
			status: "DRAFT",
			scheduledAt: null,
			webinarId: webinars.published.id,
			segmentId: segments.itLeaders.id,
			ccCampaignId: null,
			ccActivityId: null,
			htmlContent: sampleHtml(
				"Modernizing the Contact Center",
				"See a live walkthrough of consolidating telephony, chat, and CRM into Microsoft Teams — including the migration plan our engineers use.",
				"Save my seat",
				"https://events.teams.microsoft.com/event/seed-webinar-002",
			),
			targets: [],
			statSeed: 5,
		},
		{
			name: "CQSD Managed Services Nurture #1",
			subject: "What a co-managed IT model actually looks like",
			volumeNumber: null,
			status: "DRAFT",
			scheduledAt: null,
			webinarId: null,
			segmentId: null,
			ccCampaignId: null,
			ccActivityId: null,
			htmlContent: sampleHtml(
				"Co-managed IT, demystified",
				"Most teams don't need to outsource IT — they need a second set of hands with runbooks. Here's how a co-managed model splits the work in practice.",
				"See the model",
				"https://cqsddigital.example/managed-services",
			),
			targets: [],
			statSeed: 6,
		},
	];

	const seeded: SeededCampaign[] = [];
	for (const def of defs) {
		const data = {
			name: def.name,
			subject: def.subject,
			fromName,
			fromEmail,
			replyTo,
			htmlContent: def.htmlContent,
			volumeNumber: def.volumeNumber,
			status: def.status,
			scheduledAt: def.scheduledAt,
			webinarId: def.webinarId,
			segmentId: def.segmentId,
			ccCampaignId: def.ccCampaignId,
			ccActivityId: def.ccActivityId,
		};

		let campaign: { id: string };
		if (def.ccActivityId) {
			campaign = await prisma.campaign.upsert({
				where: { ccActivityId: def.ccActivityId },
				update: data,
				create: data,
			});
		} else {
			const existing = await prisma.campaign.findFirst({ where: { name: def.name } });
			campaign = existing
				? await prisma.campaign.update({ where: { id: existing.id }, data })
				: await prisma.campaign.create({ data });
		}
		seeded.push({ id: campaign.id, name: def.name });

		if (def.status !== "SENT" || !def.scheduledAt) continue;

		// Per-contact engagement: ~60% open, ~25% click of targeted contacts (clicks ⊆ opens).
		const sentAtMs = def.scheduledAt.getTime();
		const activityRows = def.targets.map((target) => {
			const i = target.index;
			const opened = seededRandom(10 + def.statSeed, i) < 0.6;
			const clicked = opened && seededRandom(20 + def.statSeed, i) < 0.42;
			const openCount = opened ? 1 + Math.floor(seededRandom(30 + def.statSeed, i) * 3) : 0;
			const clickCount = clicked ? 1 + Math.floor(seededRandom(40 + def.statSeed, i) * 2) : 0;
			const firstOpenAt = opened
				? new Date(sentAtMs + Math.floor((2 + seededRandom(50 + def.statSeed, i) * 46) * 3_600_000))
				: null;
			return {
				contactId: target.id,
				campaignId: campaign.id,
				opened,
				clicked,
				openCount,
				clickCount,
				firstOpenAt,
			};
		});

		await prisma.contactCampaignActivity.createMany({ data: activityRows, skipDuplicates: true });

		const statData = {
			sends: activityRows.length,
			opens: activityRows.reduce((sum, row) => sum + row.openCount, 0),
			uniqueOpens: activityRows.filter((row) => row.opened).length,
			clicks: activityRows.reduce((sum, row) => sum + row.clickCount, 0),
			uniqueClicks: activityRows.filter((row) => row.clicked).length,
			bounces: 1,
			optouts: def.statSeed === 3 ? 1 : 0,
			lastSyncedAt: daysFromNow(-1, 6),
		};
		await prisma.campaignStat.upsert({
			where: { campaignId: campaign.id },
			update: statData,
			create: { campaignId: campaign.id, ...statData },
		});
	}

	return seeded;
}

async function seedRegistrationsAndAttendance(
	webinars: { completed: SeededWebinar; published: SeededWebinar },
	contacts: SeededContact[],
): Promise<{ registrations: number; attendance: number }> {
	// ~20 registrations for the completed webinar (first 20 contacts spread across all orgs).
	const completedRegistrants = contacts.slice(0, 20);
	await prisma.registration.createMany({
		data: completedRegistrants.map((contact) => {
			const i = contact.index;
			return {
				webinarId: webinars.completed.id,
				contactId: contact.id,
				name: `${contact.firstName} ${contact.lastName}`,
				email: contact.email,
				source: seededRandom(60, i) < 0.7 ? ("WEBSITE" as const) : ("TEAMS" as const),
				registeredAt: daysFromNow(-13 + Math.floor(seededRandom(61, i) * 6), 10, (i * 7) % 60),
				msRegistrationId: `seed-ms-reg-${pad(i + 1)}`,
				joinUrl: webinars.completed.joinUrl,
			};
		}),
		skipDuplicates: true,
	});

	// A handful of early registrations for the upcoming published webinar.
	const publishedRegistrants = contacts.slice(20, 26);
	await prisma.registration.createMany({
		data: publishedRegistrants.map((contact) => {
			const i = contact.index;
			return {
				webinarId: webinars.published.id,
				contactId: contact.id,
				name: `${contact.firstName} ${contact.lastName}`,
				email: contact.email,
				source: seededRandom(62, i) < 0.8 ? ("WEBSITE" as const) : ("TEAMS" as const),
				registeredAt: daysFromNow(-(1 + Math.floor(seededRandom(63, i) * 3)), 11, (i * 11) % 60),
				msRegistrationId: `seed-ms-reg-${pad(100 + i)}`,
				joinUrl: webinars.published.joinUrl,
			};
		}),
		skipDuplicates: true,
	});

	// 14 of the 20 registrants attended (deterministic index rule), with plausible
	// join offsets and durations inside the webinar's one-hour window.
	const attendees = completedRegistrants.filter(
		(contact) => contact.index % 10 !== 3 && contact.index % 10 !== 6 && contact.index % 10 !== 9,
	);
	const startMs = webinars.completed.startsAt.getTime();
	const endMs = webinars.completed.endsAt.getTime();
	await prisma.attendance.createMany({
		data: attendees.map((contact) => {
			const i = contact.index;
			const joinTime = new Date(startMs + Math.floor(seededRandom(71, i) * 600) * 1_000);
			const rawDurationSeconds = 1_800 + Math.floor(seededRandom(72, i) * 1_500);
			const leaveMs = Math.min(joinTime.getTime() + rawDurationSeconds * 1_000, endMs);
			return {
				webinarId: webinars.completed.id,
				contactId: contact.id,
				email: contact.email,
				joinTime,
				leaveTime: new Date(leaveMs),
				durationSeconds: Math.round((leaveMs - joinTime.getTime()) / 1_000),
				attended: true,
				msAttendanceRecordId: `seed-ms-att-${pad(i + 1)}`,
			};
		}),
		skipDuplicates: true,
	});

	return {
		registrations: completedRegistrants.length + publishedRegistrants.length,
		attendance: attendees.length,
	};
}

async function seedLeadImportJobs(): Promise<void> {
	const defs = [
		{
			source: "CSV" as const,
			status: "COMPLETED" as const,
			count: 24,
			fileRef: "seed/csv/q2-tradeshow-contacts.csv",
			createdAt: daysFromNow(-21, 15),
		},
		{
			source: "LEADGEN" as const,
			status: "COMPLETED" as const,
			count: 18,
			fileRef: "seed/leadgen/healthcare-icp-batch-1.csv",
			createdAt: daysFromNow(-16, 10),
		},
	];

	for (const def of defs) {
		const existing = await prisma.leadImportJob.findFirst({ where: { fileRef: def.fileRef } });
		if (existing) {
			await prisma.leadImportJob.update({
				where: { id: existing.id },
				data: { source: def.source, status: def.status, count: def.count },
			});
		} else {
			await prisma.leadImportJob.create({ data: def });
		}
	}
}

async function seedAuditLog(adminId: string): Promise<void> {
	const rows = [
		{
			action: "contact.import",
			entity: "LeadImportJob",
			meta: { source: "CSV", count: 24, fileRef: "seed/csv/q2-tradeshow-contacts.csv" },
			createdAt: daysFromNow(-21, 15, 5),
		},
		{
			action: "segment.sync-to-cc",
			entity: "Segment",
			meta: { name: "Healthcare Accounts", pushed: 14 },
			createdAt: daysFromNow(-15, 11),
		},
		{
			action: "campaign.push-to-cc",
			entity: "Campaign",
			meta: { name: "AI in CS Webinar — Invite (Vol 1)" },
			createdAt: daysFromNow(-14, 13),
		},
		{
			action: "campaign.schedule",
			entity: "Campaign",
			meta: {
				name: "Q3 Pipeline Newsletter — Greg's Accounts",
				scheduledAt: daysFromNow(3, 15).toISOString(),
			},
			createdAt: daysFromNow(-2, 16),
		},
		{
			action: "webinar.publish",
			entity: "Webinar",
			meta: { title: "Modernizing the Contact Center with Microsoft Teams" },
			createdAt: daysFromNow(-5, 9),
		},
		{
			action: "attendance.sync",
			entity: "Webinar",
			meta: { title: "AI in Customer Service: From Hype to ROI", synced: 14 },
			createdAt: daysFromNow(-6, 18),
		},
	];

	for (const row of rows) {
		const existing = await prisma.auditLog.findFirst({
			where: { action: row.action, entity: row.entity },
		});
		if (!existing) {
			await prisma.auditLog.create({
				data: {
					userId: adminId,
					action: row.action,
					entity: row.entity,
					meta: row.meta,
					createdAt: row.createdAt,
				},
			});
		}
	}
}

async function printSummary(): Promise<void> {
	const [
		users,
		organizations,
		contacts,
		segments,
		segmentMembers,
		webinars,
		campaigns,
		campaignStats,
		campaignActivity,
		registrations,
		attendance,
		leadImportJobs,
		auditLogs,
	] = await Promise.all([
		prisma.user.count(),
		prisma.organization.count(),
		prisma.contact.count(),
		prisma.segment.count(),
		prisma.segmentMember.count(),
		prisma.webinar.count(),
		prisma.campaign.count(),
		prisma.campaignStat.count(),
		prisma.contactCampaignActivity.count(),
		prisma.registration.count(),
		prisma.attendance.count(),
		prisma.leadImportJob.count(),
		prisma.auditLog.count(),
	]);

	console.log("[seed] summary:");
	console.log(`  users:                     ${users}`);
	console.log(`  organizations:             ${organizations}`);
	console.log(`  contacts:                  ${contacts}`);
	console.log(`  segments:                  ${segments}`);
	console.log(`  segment members:           ${segmentMembers}`);
	console.log(`  webinars:                  ${webinars}`);
	console.log(`  campaigns:                 ${campaigns}`);
	console.log(`  campaign stats:            ${campaignStats}`);
	console.log(`  contact campaign activity: ${campaignActivity}`);
	console.log(`  registrations:             ${registrations}`);
	console.log(`  attendance:                ${attendance}`);
	console.log(`  lead import jobs:          ${leadImportJobs}`);
	console.log(`  audit log rows:            ${auditLogs}`);
}

// ============================================================
// Entrypoint
// ============================================================

/**
 * Creates (or updates) the first admin user, then — unless SEED_SAMPLE_DATA is
 * "false" — a rich, fully deterministic sample dataset. Every write is an upsert
 * (or createMany with skipDuplicates) keyed on unique fields, so re-running the
 * seed never duplicates data. Run with `bun run seed`.
 */
async function seed(): Promise<void> {
	const admin = await seedAdmin();

	if (process.env.SEED_SAMPLE_DATA === "false") {
		console.log("[seed] SEED_SAMPLE_DATA=false — skipping sample data");
		return;
	}

	const orgs = await seedOrganizations();
	const contacts = await seedContacts(orgs);
	const segments = await seedSegments(orgs, contacts);
	const webinars = await seedWebinars();
	await seedCampaigns(webinars, segments, contacts);
	await seedRegistrationsAndAttendance(webinars, contacts);
	await seedLeadImportJobs();
	await seedAuditLog(admin.id);
	await printSummary();
}

seed()
	.catch((error) => {
		console.error("[seed] failed", error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
