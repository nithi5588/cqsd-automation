# Constant Contact v3 API — Full Surface

Sourced from Constant Contact's official developer portal (developer.constantcontact.com)
and, where marked, verified live against the connected InvisiEdge account. This
covers the **entire** v3 API — not just what this app currently uses — so you can
see what else is available.

Base URL for all of these: `https://api.cc.email/v3`

**Confidence key:**
- ✅ **Used** — already implemented in this app (`packages/integrations/src/constant-contact/client.ts`)
- 🔎 **Verified live** — confirmed directly against the connected account this session, not yet (or only partly) used
- 📄 **Documented** — from Constant Contact's official docs, not independently verified here

---

## ⚠️ The one thing most worth knowing: Segments ≠ Contact Lists

Constant Contact has **two different grouping mechanisms**, and this app currently
only imports one of them:

| | Contact Lists (`/v3/contact_lists`) | Segments (`/v3/segments`) |
|---|---|---|
| Membership | **Static** — you explicitly add/remove contacts | **Dynamic** — computed live from `segment_criteria` rules (e.g. "opened the last campaign," "in list X and has custom field Y") |
| What this app does with it | ✅ Imported as local `Segment` (type `CC_LIST`) | 📄 Not imported at all |

This is conceptually almost identical to how *this app's own* Segments work
(INDUSTRY / AE / PERSONA / ALL are all criteria-based) — Constant Contact's native
Segments are the same idea, just CC's own version of it. Worth a future import pass
if you want CC's dynamic segments to show up here too, separate from lists.

---

## Contacts

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/contacts` | ✅ Used | List every contact. Supports `include=list_memberships,custom_fields,taggings,notes,phone_numbers,street_addresses`, `email`, `lists`, `status`, `updated_after` filters. |
| POST | `/v3/contacts` | 📄 Documented | Create a contact directly (full field set — this app uses the sign-up-form endpoint instead, see below). |
| GET | `/v3/contacts/{contact_id}` | 📄 Documented | Get one contact. |
| PUT | `/v3/contacts/{contact_id}` | 📄 Documented | Full update of a contact. |
| DELETE | `/v3/contacts/{contact_id}` | 📄 Documented | Permanently delete a contact. |
| POST | `/v3/contacts/{contact_id}/soft_delete` | 📄 Documented | "Soft" delete — retains the record but removes them from your account's active contacts. |
| POST | `/v3/contacts/sign_up_form` | ✅ Used | Create-or-update-by-email — this is what this app actually calls to push one contact. |
| GET | `/v3/contacts/consent_counts` | 📄 Documented | Aggregate opt-in/opt-out counts. |
| GET | `/v3/contacts/{contact_id}/sms_channel/activities` | 📄 Documented | SMS engagement history for a contact (if SMS is enabled on the account). |

## Contact Lists

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/contact_lists` | ✅ Used | List every list. 🔎 Verified live — returns `list_id`, `name`, `description`, `favorite`, timestamps. |
| POST | `/v3/contact_lists` | ✅ Used | Create a list. |
| GET | `/v3/contact_lists/{list_id}` | 📄 Documented | Get one list's detail. |
| PUT | `/v3/contact_lists/{list_id}` | 📄 Documented | Rename/update a list. |
| DELETE | `/v3/contact_lists/{list_id}` | 📄 Documented | Delete a list. |

## Contact Tags

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/contact_tags` | 📄 Documented | List every tag on the account. |
| POST | `/v3/contact_tags` | 📄 Documented | Create a tag (`name`, optional `tag_source`). |
| GET / PUT / DELETE | `/v3/contact_tags/{tag_id}` | 📄 Documented | Get/rename/delete one tag. |
| — | contact-level tagging | 📄 Documented | Tags are applied to a contact by including `taggings` on a contact create/update, or via bulk activities below. |

Not used by this app at all right now — tags are a lighter-weight alternative to lists for ad-hoc grouping.

## Contact Custom Fields

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/contact_custom_fields` | 📄 Documented | List custom fields defined on the account. |
| POST | `/v3/contact_custom_fields` | 📄 Documented | Create a custom field. |
| GET / PUT / DELETE | `/v3/contact_custom_fields/{custom_field_id}` | 📄 Documented | Get/update/delete one. |
| POST | `/v3/activities/custom_fields_delete` | 📄 Documented | Async bulk removal of a custom field's values from up to 100 contacts. |

Not used — this app currently only maps `job_title` and `company_name` from CC, not custom fields.

## Segments (native, dynamic — see the callout above)

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/segments` | 📄 Documented | List every segment. Sortable by `name` or `date`. |
| POST | `/v3/segments` | 📄 Documented | Create a segment (`name` + `segment_criteria`). |
| GET / PUT / DELETE | `/v3/segments/{segment_id}` | 📄 Documented | Get/update/delete one segment. |
| GET | `/v3/segments/{segment_id}/contacts` | 📄 Documented | List the contacts currently matching a segment's criteria. |

Not imported by this app — only Contact Lists are (see callout above).

## Bulk Activities (async — for large operations)

| Method | Path | Status | What it does |
|---|---|---|---|
| POST | `/v3/activities/contacts_json_import` | ✅ Used | Async bulk-import contacts (JSON payload) into given lists. |
| POST | `/v3/activities/contacts_csv_import` | 📄 Documented | Same, but a CSV file upload instead of JSON. |
| POST | `/v3/activities/contact_exports` | 📄 Documented | Async export of contacts to CSV, filterable by list/tag/status/date. |
| POST | `/v3/activities/contacts_delete` | 📄 Documented | Bulk-delete up to 1,000 contacts by id. |
| POST | `/v3/activities/list_memberships` | 📄 Documented | Bulk add/remove contacts from lists. |
| POST | `/v3/activities/taggings` | 📄 Documented | Bulk add/remove tags from contacts. |
| POST | `/v3/activities/custom_fields_delete` | 📄 Documented | (also listed above) bulk-clear a custom field's values. |
| GET | `/v3/activities/{activity_id}` | 📄 Documented | Poll the status of any async bulk activity above. |

This app's own contact CSV/LeadGen import is handled locally (not via these CC bulk
endpoints) — worth considering if you ever need CC-side bulk operations at scale.

## Email Campaigns

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/emails` | ✅ Used | List every campaign. 🔎 Verified live — does **not** include `campaign_activities`, only `campaign_id`/`name`/`current_status`/`type`/timestamps. |
| POST | `/v3/emails` | ✅ Used | Create a campaign with its first activity. |
| GET | `/v3/emails/{campaign_id}` | ✅ Used | Full campaign resource. 🔎 Verified live — **this** is where `campaign_activities` (and so the activity id) actually lives. |
| DELETE | `/v3/emails/{campaign_id}` | 📄 Documented | Delete a campaign. |
| GET | `/v3/emails/activities/{campaign_activity_id}` | ✅ Used | One activity's full content (subject, from, html, status). |
| PUT | `/v3/emails/activities/{campaign_activity_id}` | ✅ Used | Full-document update — this app uses it to set `contact_list_ids`. |
| POST | `/v3/emails/activities/{campaign_activity_id}/schedules` | ✅ Used | Schedule a send. |
| DELETE | `/v3/emails/activities/{campaign_activity_id}/schedules` | ✅ Used | Unschedule. |
| POST | `/v3/emails/activities/{campaign_activity_id}/tests` | ✅ Used | Send a test to specific addresses. |
| POST | `/v3/emails/activities/{campaign_activity_id}/resend` | 📄 Documented | "Resend to non-openers" — sends a follow-up only to contacts who didn't open the original. |
| POST | `/v3/emails/activities/{campaign_activity_id}/preview` | 📄 Documented | Get an HTML preview render. |
| — | A/B Tests | 📄 Documented | Separate sub-API for creating/managing subject-line or content A/B tests on a campaign. |

## Email Reporting

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/reports/stats/email_campaign_activities/{campaign_activity_id}` | ✅ Used | Aggregate counts: sends, unique/total opens, unique/total clicks, bounces, optouts. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/unique_opens` | ✅ Used | Row-level: who opened. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/clicks` | ✅ Used | Row-level: who clicked, which link. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/bounces` | ✅ Used | Row-level: who bounced, bounce code. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/sends` | ✅ Used | Row-level: who it was sent to. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/optouts` | ✅ Used | Row-level: who unsubscribed from this send. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/tracking/forwards` | 📄 Documented | Row-level: who forwarded the email. |
| GET | `/v3/reports/email_reports/{campaign_activity_id}/link_reports` | 📄 Documented | Per-link click breakdown (which specific URL got clicked how many times). |
| GET | `/v3/reports/summary_reports` | 📄 Documented | Account-wide summary across all campaigns in a date range. |

## Contact Reporting

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/reports/contact_activities/{contact_id}` | 📄 Documented | Per-contact engagement history — every open/click across every campaign, not just one. |

Not used — this app builds the equivalent view (`ContactCampaignActivity`) from its
own sync job rather than calling this directly.

## Events (Constant Contact's own event/ticketing product — unrelated to Teams)

| Method | Path | Status | What it does |
|---|---|---|---|
| GET / POST | `/v3/events` | 📄 Documented | List/create in-person or virtual events sold/managed through Constant Contact itself. |
| GET / PUT / DELETE | `/v3/events/{event_id}` | 📄 Documented | Manage one event. |
| — | Registrations, tickets, fees, check-in | 📄 Documented | Full sub-API for event registration and day-of check-in. |

Not relevant to this app — webinars here are run through **Microsoft Teams**
(Graph API), a completely separate system from Constant Contact's own Events product.

## Social

| Method | Path | Status | What it does |
|---|---|---|---|
| — | Profiles, connections, hashtag groups, posts | 📄 Documented | Manage connected social accounts (Facebook/Instagram/etc.) and publish posts through Constant Contact. |

Not used.

## SMS Reports

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/reports/sms_campaign_summary` | 📄 Documented | SMS campaign performance (only relevant if the account has SMS marketing enabled). |

Not used.

## Landing Page Reports

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/reports/landing_pages/...` | 📄 Documented | Clicks/opens/signups/SMS opt-ins for Constant Contact's own landing-page product. |

Not used.

## Account Services

| Method | Path | Status | What it does |
|---|---|---|---|
| GET | `/v3/account/summary` | 📄 Documented | Account name, organization name, timezone, country/state. |
| GET / PUT | `/v3/account/emails` | 📄 Documented | Verified "from" email addresses on the account. |
| GET / PUT | `/v3/account/physical_address` | 📄 Documented | Required CAN-SPAM physical address shown in every campaign footer. |
| GET | `/v3/account/user_privileges` | 📄 Documented | What the authenticated user is allowed to do. |

Not used — `account_read` scope is already requested (visible in this app's granted
scopes) but nothing calls these endpoints yet.

## Technology Partners / Partner Webhooks

These two groups are for **Constant Contact reseller/partner accounts** managing
many client accounts (billing, SSO, webhook subscriptions for tier changes) —
not applicable to a normal single-account integration like this one.

---

## Where this list came from

- Everything marked ✅ is already implemented and running in `packages/integrations/src/constant-contact/client.ts`.
- Everything marked 🔎 was confirmed by making live calls against the connected InvisiEdge account this session (this is how the campaign-import bug got found and fixed).
- Everything marked 📄 comes from Constant Contact's official developer portal (`developer.constantcontact.com`) — the actual JSON request/response bodies weren't independently re-verified for those, so double-check field names against the live docs before building against any of them.
