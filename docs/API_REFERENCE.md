# CQSD Marketing Automation — API Reference

Every route this backend (`packages/api`) exposes, grouped by module. This is the
internal REST API the dashboard (`public_site`) talks to — not Constant Contact's
or Microsoft's APIs (those are covered at the bottom, since this app wraps them).

## Basics

- **Base URL**: `http://localhost:3000` in local dev; the deployed Railway API in production.
- **Auth**: JWT bearer token. Call `POST /auth/login` to get one, then send `Authorization: Bearer <token>` on every other request.
- **Roles**: `ADMIN` and `MEMBER`. Routes marked **ADMIN** in the table below 403 for a MEMBER token.
- **Errors**: every failure returns `{ "error": { "code": "...", "message": "..." } }` with a matching HTTP status — there's no other error shape anywhere in the API.
- **Pagination**: list endpoints accept `?page=1&pageSize=25` and return `{ items, page, pageSize, total }`.
- **Health check**: `GET /health` → `{ status, database }`, no auth required. Used for uptime checks.

---

## Auth (`/auth`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| POST | `/auth/login` | none | Exchanges email + password for a JWT. |
| GET | `/auth/me` | any | Returns the signed-in user's id, email, and role. |

## OAuth (`/oauth`) — connecting Constant Contact & Microsoft Teams

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/oauth/constant-contact/start` | none | Redirects the browser to Constant Contact's login/consent screen (PKCE flow). |
| GET | `/oauth/constant-contact/callback` | none | Where Constant Contact redirects back to after consent; exchanges the code for tokens, stores them, then redirects the browser to the dashboard's Connections page. |
| GET | `/oauth/microsoft/start` | none | Redirects the browser to Microsoft's login/consent screen. |
| GET | `/oauth/microsoft/callback` | none | Same handoff as the CC callback, for Microsoft Graph. |

These are hit by browser redirects, not called directly by the dashboard's JS — that's why they're unauthenticated (the state param + short-lived cookie is what protects them).

## Connections (`/connections`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/connections` | any | Returns whether Constant Contact and Microsoft are connected, token expiry, and granted scopes. |
| POST | `/connections/constant-contact/import` | **ADMIN** | Enqueues a background job that pulls every list (as a segment), contact, and campaign already sitting in the connected Constant Contact account into this app. Returns `{ jobId }` immediately — the import itself can take minutes on a large account. |
| GET | `/connections/constant-contact/import/:jobId` | **ADMIN** | Polls that job's status: `waiting` / `active` / `completed` (with the result) / `failed` (with the error), plus live progress (`phase`, `completed`, `total`) while it's running. |

## Organizations (`/organizations`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/organizations` | any | Lists companies, with search/pagination. |
| POST | `/organizations` | any | Creates a company (name, industry, revenue, AE owner). |
| GET | `/organizations/:id` | any | Gets one company's detail. |
| PUT | `/organizations/:id` | any | Updates a company. |
| DELETE | `/organizations/:id` | any | Deletes a company. |

## Contacts (`/contacts`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/contacts` | any | Lists contacts — filterable by search, persona, industry, org, segment. |
| POST | `/contacts` | any | Creates a single contact. |
| POST | `/contacts/import` | any | Bulk-imports contacts from a CSV or LeadGen payload; auto-infers persona from job title, re-materializes every segment afterward. |
| GET | `/contacts/:id` | any | Full contact detail: campaign activity, webinar registrations, attendance history. |
| PUT | `/contacts/:id` | any | Updates a contact. |
| DELETE | `/contacts/:id` | any | Deletes a contact. |

## Segments (`/segments`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/segments` | any | Lists segments (industry / AE owner / persona / all-contacts / imported Constant Contact lists), each with member counts. |
| POST | `/segments` | any | Creates a criteria-based segment (industry, AE owner, persona, or "all contacts"). |
| GET | `/segments/:id` | any | Segment detail + paginated member list. |
| PUT | `/segments/:id` | any | Updates a segment's name/criteria. |
| DELETE | `/segments/:id` | any | Deletes a segment. |
| POST | `/segments/:id/refresh` | any | Recomputes membership from the segment's criteria. |
| POST | `/segments/:id/members` | any | Manually adds contacts to a segment. |
| DELETE | `/segments/:id/members/:contactId` | any | Removes one contact from a segment. |
| POST | `/segments/:id/sync-to-cc` | any | Pushes the segment's current members to a Constant Contact list (creates the CC list on first sync). |

## Leads (`/leads`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/leads/imports` | any | Lists past CSV/LeadGen bulk-import jobs and their status/counts. |

## Campaigns (`/campaigns`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/campaigns` | any | Lists campaigns, filterable by status/search. |
| POST | `/campaigns` | any | Creates a draft campaign. |
| GET | `/campaigns/:id` | any | Campaign detail including HTML content and stats. |
| PUT | `/campaigns/:id` | any | Edits a draft campaign (drafts only). |
| DELETE | `/campaigns/:id` | any | Deletes a draft campaign (drafts only). |
| POST | `/campaigns/:id/push-to-cc` | any | Creates the campaign in Constant Contact and attaches its target segment as a CC list. |
| POST | `/campaigns/:id/send-test` | any | Sends a test send to the given email addresses. |
| POST | `/campaigns/:id/schedule` | any | Schedules the pushed campaign to send at a given time. |
| POST | `/campaigns/:id/unschedule` | any | Cancels a scheduled send, back to draft. |
| POST | `/campaigns/:id/sync-stats` | any | Pulls sends/opens/clicks/bounces from Constant Contact right now (instead of waiting for the 10-minute background sync). |
| GET | `/campaigns/:id/activity` | any | Per-contact open/click activity for the campaign. |
| GET | `/campaigns/:id/activity/by-company` | any | Same activity, rolled up by company. |

## Webinars (`/webinars`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/webinars` | any | Lists webinars, filterable by status. |
| POST | `/webinars` | any | Creates a draft webinar (no Teams call yet). |
| GET | `/webinars/:id` | any | Webinar detail. |
| PUT | `/webinars/:id` | any | Updates a draft webinar. |
| DELETE | `/webinars/:id` | any | Deletes a webinar. |
| POST | `/webinars/:id/publish` | any | Creates + publishes the webinar in Microsoft Teams and fetches the join link. |
| GET | `/webinars/:id/registrations` | any | Lists everyone registered. |
| GET | `/webinars/:id/attendance` | any | Lists attendance records (join/leave time, duration). |
| POST | `/webinars/:id/attendance/sync` | any | Pulls the attendance report from Teams right now. |
| POST | `/webinars/:id/attendance/import` | any | Imports attendance from a manually-uploaded Teams CSV export (the no-admin-consent fallback). |
| GET | `/webinars/:id/account-plan` | any | Attendance/engagement rolled up by company for this webinar. |

### Public (unauthenticated — the website calls these)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/public/webinars/:slug` | none | Public webinar info (title, schedule, description) for the registration page. |
| POST | `/public/webinars/:slug/register` | none | Registers a visitor — saves them locally and in Teams, returns their personal join link. |

## Account Plans (`/account-plans`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/account-plans` | any | Lists companies with an account-plan summary (engagement + attendance rollup). |
| GET | `/account-plans/:orgId` | any | Full account plan for one company: contacts, campaign engagement, webinar attendance, by persona. |
| GET | `/account-plans/:orgId/export` | any | Downloads that same account plan as a CSV. |

## Overview (`/overview`)

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/overview` | any | Everything the dashboard's home page needs in one call: KPIs, engagement trend, funnel, campaign/webinar performance, persona split, top companies, needs-attention list, recent activity, recent campaigns, upcoming webinars. |

## Admin (`/admin`) — all ADMIN-only

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/admin/users` | **ADMIN** | Lists every dashboard user. |
| POST | `/admin/users` | **ADMIN** | Creates a new dashboard login. |
| PUT | `/admin/users/:id` | **ADMIN** | Updates a user (role, password, etc.). |
| DELETE | `/admin/users/:id` | **ADMIN** | Deletes a user. |
| GET | `/admin/audit` | **ADMIN** | Lists the full audit trail (who did what, when) across the whole app. |

---

## Under the hood: third-party APIs this app wraps

The dashboard never calls these directly — only the backend does, through the
typed clients in `packages/integrations`.

### Constant Contact (`ConstantContactClient`)
- **Contacts**: create/update one contact, bulk-import contacts into a list, list every contact in the account (with list memberships).
- **Lists**: create a list, list every list in the account.
- **Campaigns**: create an email campaign, attach it to a list, schedule/unschedule a send, send a test, list every campaign in the account, fetch one campaign's full detail (to find its send activity).
- **Reporting**: aggregate stats (sends/opens/clicks/bounces) for one campaign activity, plus row-level tracking (who opened, who clicked, who bounced, who unsubscribed).

### Microsoft Graph — virtual events / Teams (`GraphClient`)
- **Delegated** (signed in as the organizer): create a webinar draft, publish it.
- **App-only** (background jobs): list a webinar's sessions, get webinar status/registration URL, register an anonymous attendee, list registrations, pull attendance records for a session.
