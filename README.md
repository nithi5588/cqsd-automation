# CQSD Marketing & Webinar Automation

One dashboard that replaces the Constant Contact + Microsoft Teams + Excel juggling: contacts and
segments, scheduled email campaigns with **per-contact / per-company opens & clicks** (Constant
Contact), one-click Teams webinars with automatic **attendance sync**, website registration capture,
and **account-planning reports** for sales — exportable to CSV/Excel.

## Stack

- **Runtime:** Bun (not Node/npm)
- **API:** [Hono](https://hono.dev), served via `Bun.serve` on port **3000**
- **Dashboard:** Next.js 16 + React 19 + Tailwind v4 on port **3001** (`public_site/`)
- **Database:** PostgreSQL + Prisma
- **Background jobs:** [BullMQ](https://bullmq.io) on Redis, running **in-process inside the api**
  (`packages/api/src/workers`) — `sync-campaign-stats` every 10 min, `sync-attendance` hourly,
  `refresh-tokens` every 30 min
- **Validation:** zod · **Auth:** JWT + roles (`ADMIN`/`MEMBER`) · **Tokens at rest:** AES-256-GCM
- **Lint/format:** [Biome](https://biomejs.dev)

## Monorepo layout

```
public_site/      Next.js frontend: the team dashboard (overview, contacts, segments, campaigns +
                  analytics, webinars + attendance, account plans, lead imports, connections, admin)
                  plus the PUBLIC webinar registration page (/register/[slug]) for the website
packages/
  config/         env schemas (zod + @t3-oss/env-core)
  db/             Prisma schema, migrations, generated client, seed (admin + rich demo data)
  shared/         HttpError mapping, AES-256-GCM encryption, JWT + auth middleware, pagination, logger
  jobs/           BullMQ Queue/Worker wrappers
  integrations/   token-store + Constant Contact v3 client (contacts, lists, campaigns, schedules,
                  tracking reports) + Microsoft Graph client (webinars, registrations, attendance)
  api/            Hono app: routes -> controllers -> services -> Prisma + in-process workers
scripts/          local dev CLI: `bun run up|down|status|dev`
docs/             CONSTANT_CONTACT_SETUP.md · TEAMS_SETUP.md (step-by-step external setup)
```

## First-time setup

```bash
cp .env.example .env          # fill in secrets — see docs/ guides for the two providers
bun install
bun run db:generate           # generate the Prisma client
bun run up                    # local docker Postgres/Redis — skip if DATABASE_URL/REDIS_URL point at hosted instances (e.g. Railway)
bun run db:migrate            # apply migrations
bun run db:seed               # admin user + demo data (SEED_SAMPLE_DATA=false for admin only)
bun run dev                   # api on :3000 + dashboard on :3001
```

Then open **http://localhost:3001** and sign in (default seed: `admin@cqsddigital.com` with
`SEED_ADMIN_PASSWORD` from `packages/db/.env`).

`packages/db` needs its own small `.env` (Prisma CLI resolves env relative to `schema.prisma`) with
at least `DATABASE_URL`.

## API keys / secrets you must provide (`.env`)

| Key | Where to get it | Needed for |
|---|---|---|
| `CC_CLIENT_ID` (+ `CC_CLIENT_SECRET` only if your CC app has one — secret-less apps use PKCE automatically) | [Constant Contact developer portal](https://developer.constantcontact.com) → My Applications (the "API key" is the client id) | Pushing contacts/segments, creating + scheduling campaigns, reading opens/clicks/bounces |
| `MS_TENANT_ID` / `MS_CLIENT_ID` / `MS_CLIENT_SECRET` | Azure Portal → Entra ID → App registrations | Creating/publishing Teams webinars, registrations, attendance reports |
| `MS_ORGANIZER_UPN` | The mailbox that hosts webinars (needs M365 E3/E5 or Teams Premium) | Webinar organizer identity |
| `JWT_SECRET`, `ENCRYPTION_KEY` | Generate yourself (`openssl rand -base64 32` for the key) | Dashboard auth, token encryption |

After filling the env keys, open **Connections** in the dashboard and click **Connect** on each
provider — one-time OAuth stores encrypted tokens that auto-refresh from then on. Step-by-step
guides with screenshots-level detail (incl. the Teams **Application Access Policy** PowerShell that
prevents 403s): **`docs/CONSTANT_CONTACT_SETUP.md`** and **`docs/TEAMS_SETUP.md`**.

## Commands

| Command | What it does |
|---|---|
| `bun run up` / `down` / `status` | Manage local Postgres + Redis (docker compose) |
| `bun run dev` | `up`, then start api (:3000) + dashboard (:3001) |
| `bun run dev:api` / `dev:site` | Start one side only |
| `bun run db:generate` / `db:migrate` / `db:seed` / `db:studio` | Prisma lifecycle |
| `bun run typecheck` / `test` / `lint` / `lint:fix` | Quality gates (all green) |

## Feature status

**Built and verified end-to-end (UI + API + DB + jobs):**

- Contacts CRUD, CSV import (with company/persona auto-tagging), org auto-creation
- Segments by industry / AE / persona with auto-materialized members + one-click **Sync to Constant
  Contact** (creates the CC list, bulk-imports members)
- Campaigns: create → **Push to Constant Contact** → test send → schedule volumes; stats sync
  (sends, unique opens/clicks, bounces, opt-outs) with **per-contact** and **per-company**
  open/click breakdowns; hard bounces auto-removed from segments
- Webinars: one-click **Publish to Teams** (draft → publish → join link, Teams' own attendee emails
  disabled), public website registration endpoint (`POST /public/webinars/:slug/register`) that
  saves to our DB and registers on Teams, **attendance sync** with join/leave/duration + show rate
- Account plans: per-company engagement (personas, opens, clicks, webinar time attended) with
  **CSV export** for the sales team; overview dashboard with KPIs and trend charts
- Admin: user management + audit log; OAuth connections page
- Background jobs registered and running in-process (stats every 10 min, attendance hourly,
  token refresh every 30 min) — all writes are idempotent upserts keyed on external IDs

**Remaining/optional (Phase 3+):** Graph change-notification webhooks instead of polling, LeadGen
API import (CSV import works today), a template library, SalesHandy handoff.
