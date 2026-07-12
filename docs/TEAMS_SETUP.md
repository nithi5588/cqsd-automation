# Microsoft Teams (Graph API) — Step-by-Step Setup

This connects the dashboard to Microsoft Teams so it can create/publish webinars,
register people, and pull attendance reports automatically (who attended and for
how long) — the data that used to be downloaded from Teams into Excel by hand.

You need someone with **Microsoft 365 admin rights** for steps 2–4. Everything else
is copy-paste.

---

## ⚠️ You do NOT need to create a new tenant

A common mistake is trying **Create a tenant** in the Azure portal. Don't — and if you
tried and got an error like *"This domain 'x.onmicrosoft.com' is being used by
context ..."*, it just means that domain name is already taken (possibly by your own
earlier attempt — check Portal → top-right account menu → **Switch directory** to see
directories you already belong to).

More importantly, a brand-new empty tenant is **useless for this integration**:

- The webinars, the organizer mailbox, the Teams licenses, and the attendance data all
  live in your **company's existing Microsoft 365 tenant** (the one whose accounts you
  use for Teams every day).
- A fresh tenant has no Teams users, no licenses, and no webinars — an app registered
  there cannot see your company's webinars at all.

**What to do instead:** sign in to https://portal.azure.com with a work account from
the tenant that hosts the webinars (e.g. the CompQsoft tenant that owns the
`webinar@...` mailbox), then follow Step 1 below — **App registrations → New
registration** inside that existing tenant. If your account lacks permission to
register apps or grant admin consent, the Microsoft 365 admin has to do Steps 1–3 (send
them this document — it's 15 minutes of work).

## Step 1 — Register an app in Microsoft Entra (Azure AD)

1. Go to https://portal.azure.com → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. Name: `CQSD Marketing Dashboard`.
3. Supported account types: **Accounts in this organizational directory only** (single tenant).
4. Redirect URI: choose **Web** and enter:
   - `http://localhost:3000/oauth/microsoft/callback` (for local testing)
   - later add your production URL, e.g. `https://api.yourdomain.com/oauth/microsoft/callback`
5. Click **Register**.
6. On the app's **Overview** page, copy these into your `.env`:
   - **Application (client) ID** → `MS_CLIENT_ID`
   - **Directory (tenant) ID** → `MS_TENANT_ID`
7. Go to **Certificates & secrets** → **New client secret** → copy the **Value**
   (not the Secret ID!) immediately → `MS_CLIENT_SECRET`.
   ⚠️ The value is only shown once. Set a 12–24 month expiry and calendar a reminder.

## Step 2 — Add Graph API permissions

In the app registration → **API permissions** → **Add a permission** → **Microsoft Graph**:

**Delegated permissions** (used when the organizer account signs in via the dashboard
to create/publish webinars):
- `VirtualEvent.ReadWrite`
- `offline_access`

**Application permissions** (used by the background sync to read attendance and
register external attendees without a signed-in user):
- `VirtualEvent.Read.All`
- `VirtualEventRegistration-Anon.ReadWrite.All`
- `OnlineMeetingArtifact.Read.All`

Then click **Grant admin consent for <your org>** (requires admin). All rows should
show a green check.

## Not the tenant admin? Read this first

You can register the app (Step 1) as a regular user, but **Step 2's "Grant admin
consent" button and Step 3's PowerShell only work for a Global Administrator or
Teams Administrator of the tenant**. If that's not you:

1. Send this document to whoever administers the Microsoft 365 tenant and ask for
   two things (~10 minutes): click **Grant admin consent** on your app's API
   permissions page, and run the two PowerShell commands in Step 3.
2. You can test in **two stages** — admin consent alone already unlocks connecting
   and one-click webinar publishing (delegated calls). The PowerShell policy is only
   needed for the app-only calls: attendance sync, pulling Teams-side registrants,
   and registering website visitors into Teams. Until it's granted, those three
   return a clear 403 in the dashboard; everything else works.
3. No admin anywhere? Create your own **Microsoft 365 E5 trial tenant**
   (microsoft.com → Microsoft 365 E5 free trial). You become Global Admin of that
   fresh tenant, the trial includes the Teams license webinars require, and you can
   do Steps 1–4 yourself end to end. Register a NEW app inside that tenant and use
   its tenant/client/secret in `.env` for testing.

Where do the PowerShell commands run? **On any machine** (your own laptop's
PowerShell is fine) — they configure the tenant, not this project. The person
running them signs in as the admin when `Connect-MicrosoftTeams` opens the login
window.

## Step 3 — Application Access Policy (the #1 gotcha)

Even with the permissions above granted, attendance and webinar reads will return
**403 Forbidden** until a Teams administrator explicitly allows the app to act on
the organizer mailbox. This is a Teams-specific policy, done once in PowerShell:

**How to run this:** on the admin's own Windows laptop — press the Start key, type
`powershell`, right-click **Windows PowerShell** → **Run as administrator**, then
paste the commands below one block at a time. (`Connect-MicrosoftTeams` opens a
Microsoft login window — sign in there with the **admin** account.) No Azure portal
page or project folder is involved; any computer with internet works.

```powershell
# Run as Teams admin
Install-Module -Name MicrosoftTeams -Force -AllowClobber
Connect-MicrosoftTeams

# Create a policy that allows YOUR app (use the Application (client) ID from Step 1)
New-CsApplicationAccessPolicy -Identity "CQSD-Dashboard-Policy" `
  -AppIds "<MS_CLIENT_ID>" `
  -Description "Allow CQSD marketing dashboard to manage webinars + attendance"

# Grant it to the webinar organizer account (the mailbox that hosts webinars)
Grant-CsApplicationAccessPolicy -PolicyName "CQSD-Dashboard-Policy" `
  -Identity "webinar@cqsddigital.com"
```

Notes:
- Replace `webinar@cqsddigital.com` with the actual organizer mailbox (set the same
  value as `MS_ORGANIZER_UPN` in `.env`).
- The policy can take **up to 30 minutes** to propagate. If you still get 403 after
  that, re-check the AppId matches your client ID exactly.

## Step 4 — Licensing check

The **organizer account** (the `MS_ORGANIZER_UPN` mailbox) must have one of:
- Microsoft 365 **E3** or **E5**, or
- **Teams Premium**

Without it, Graph refuses to create webinars for that user. A regular mailbox
license is not enough.

## Step 5 — Fill `.env` and connect in the dashboard

```env
MS_TENANT_ID=<Directory (tenant) ID>
MS_CLIENT_ID=<Application (client) ID>
MS_CLIENT_SECRET=<client secret VALUE>
MS_ORGANIZER_UPN=webinar@cqsddigital.com
MS_REDIRECT_URI=http://localhost:3000/oauth/microsoft/callback
MS_DELEGATED_SCOPES=offline_access VirtualEvent.ReadWrite
```

1. Restart the API (`bun run dev`).
2. Open the dashboard → **Connections** → **Microsoft Teams** → **Connect**.
3. Sign in **as the organizer account** (`webinar@...`), not your personal account —
   the webinars are created on behalf of whoever completes this OAuth step.
4. Approve the consent screen. You'll be redirected back and the card should show
   **Connected**.

## Step 6 — Verify it works, end to end

1. **Webinars → New webinar** → fill title/date → Create (stays DRAFT, no Graph call).
2. Open the webinar → **Publish to Teams**. This calls Graph: create draft → disable
   Teams' own attendee emails (we send comms from our domain) → publish → fetch the
   join link. Status becomes PUBLISHED and the join/registration URLs appear.
3. Register a test attendee: the public endpoint the website will call is
   `POST /public/webinars/<slug>/register` with `{ "name": "...", "email": "..." }` —
   the webinar detail page shows a copy-paste example. The person is saved in our DB
   and registered in Teams behind the scenes (they get their personal join URL).
4. Hold (or shortly attend) the webinar with a test account.
5. After it ends, Teams generates the attendance report (usually within ~15 min).
   The background job pulls it hourly, or click **Sync attendance** on the webinar
   page. You'll see each attendee's join/leave time and total duration, matched to
   contacts — this replaces the manual Excel reconciliation.
6. **Account Plans** now includes webinar attendance per company (who attended, for
   how long) alongside email opens/clicks — exportable to CSV for the sales team.

## Common errors

| Symptom | Cause | Fix |
|---|---|---|
| 403 on publish/attendance | Application Access Policy missing | Step 3 (wait 30 min) |
| 403 only on attendance/registrations | Application permissions not admin-consented | Step 2 → Grant admin consent |
| "organizer not licensed" style errors | Organizer lacks E3/E5/Teams Premium | Step 4 |
| Connected but publish fails with 401 | OAuth done with the wrong user | Reconnect as the organizer mailbox |
| Attendance empty right after webinar | Teams hasn't generated the report yet | Wait ~15 min, then Sync attendance |
