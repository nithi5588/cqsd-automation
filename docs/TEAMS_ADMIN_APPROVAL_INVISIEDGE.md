# Microsoft Teams — What the InvisiEdge Admin Needs to Do Now

Bhanu (`bhanu.p@invisiedge.com`) already registered the app and clicked **Connect** on
the dashboard's Connections page, which sent Microsoft's sign-in flow into the
InvisiEdge tenant. Because one of the requested permissions requires an
administrator, Microsoft didn't let that sign-in complete on its own — it either
generated a **pending admin consent request** or stopped with a
"Need admin approval" screen. This document is everything the **InvisiEdge tenant
admin** (Global Administrator or Teams Administrator) needs to do to unblock it.
Nothing here needs code changes or touches this repo — it's all done in the
browser (Microsoft admin portals) and PowerShell.

This is written specifically for the InvisiEdge tenant's actual current setup — the
IDs below are the real ones already configured, not placeholders.

## Reference values (already configured, no need to look these up)

| What | Value |
|---|---|
| Tenant | InvisiEdge |
| Directory (tenant) ID | `e13ed5a1-0da9-4b6e-8a9f-730119b6a1ba` |
| App name | CQSD Marketing Dashboard *(confirm by Client ID below — the display name may differ)* |
| Application (client) ID | `5e847f06-b0d4-4f9b-b06f-171ee653740f` |
| Organizer / connecting account | `bhanu.p@invisiedge.com` |
| Redirect URI in use | `http://localhost:3000/oauth/microsoft/callback` |

---

## Step 1 — Approve the pending consent request

1. Sign in to **https://entra.microsoft.com** (or portal.azure.com → Microsoft Entra ID) with the **admin** account.
2. Go to **Enterprise applications** → **Activity** → **Admin consent requests**.
3. Look for a request tied to Client ID `5e847f06-b0d4-4f9b-b06f-171ee653740f` (requested by `bhanu.p@invisiedge.com`).
4. Open it, review the permissions listed, and click **Review permissions and consent** → **Accept**.

If nothing shows up in that list (some tenants don't have the "request admin
consent" feature turned on, in which case Bhanu's sign-in would have just shown a
blocked/error screen instead of a request), skip straight to Step 1b — it grants
the same thing directly and always works regardless.

## Step 1b — Grant admin consent directly (do this either way)

Step 1 only covers the **delegated** permission Bhanu's own sign-in asked for. The
**application** permissions (used for attendance sync and registering website
visitors) never go through a user consent request at all — they need this step
regardless of whether Step 1 found anything.

1. In Entra admin center → **App registrations** → search Client ID `5e847f06-b0d4-4f9b-b06f-171ee653740f` → open it.
2. Go to **API permissions**. You should see:
   - **Delegated**: `VirtualEvent.ReadWrite`, `offline_access`
   - **Application**: `VirtualEvent.Read.All`, `VirtualEventRegistration-Anon.ReadWrite.All`, `OnlineMeetingArtifact.Read.All`
3. If any of the three **Application** permissions are missing: **Add a permission** → **Microsoft Graph** → **Application permissions** → search each name above → **Add permissions**.
4. Click **Grant admin consent for InvisiEdge** at the top → **Yes**.
5. Confirm every row now shows a green ✅ under **Status**.

## Step 2 — Application Access Policy (PowerShell — the step people miss)

Even with every permission consented above, attendance reads and webinar
management will fail with **403 Forbidden** until this policy explicitly allows the
app to act on Bhanu's mailbox. This is a Teams-specific setting, separate from
Entra, and only doable via PowerShell.

Run this **as the InvisiEdge admin**, on any machine (a personal laptop is fine —
it configures the tenant, not this project):

1. Press Start → type `powershell` → right-click **Windows PowerShell** → **Run as administrator**.
2. Paste this, then sign in with the **admin** account when the login window opens:

```powershell
Install-Module -Name MicrosoftTeams -Force -AllowClobber
Connect-MicrosoftTeams
```

3. Then paste this (already filled in with InvisiEdge's real values):

```powershell
New-CsApplicationAccessPolicy -Identity "CQSD-Dashboard-Policy" `
  -AppIds "5e847f06-b0d4-4f9b-b06f-171ee653740f" `
  -Description "Allow CQSD marketing dashboard to manage webinars + attendance"

Grant-CsApplicationAccessPolicy -PolicyName "CQSD-Dashboard-Policy" `
  -Identity "bhanu.p@invisiedge.com"
```

4. Wait — this can take **up to 30 minutes** to propagate. If it's still 403 after that, re-run the second command and double-check the AppId matches exactly.

## Step 3 — Confirm Bhanu's account is licensed for webinars

Webinars require one of these on `bhanu.p@invisiedge.com` specifically — a regular
mailbox license is not enough:

- Microsoft 365 **E3** or **E5**, or
- **Teams Premium**

Check: admin center (admin.microsoft.com) → **Users** → **Active users** → `bhanu.p@invisiedge.com` → **Licenses and apps**.

## Step 4 — Hand it back to Bhanu

Once Steps 1–3 are done, Bhanu should:

1. Go to `http://localhost:3001/connections`.
2. Click **Connect** (or **Reconnect**) under **Microsoft Teams**.
3. Sign in as `bhanu.p@invisiedge.com` — this time the consent screen should show a normal **Accept** button instead of "Need admin approval."
4. Approve it. The browser redirects back to the Connections page and the Microsoft Teams card should show **Connected**.

## Step 5 — Quick end-to-end check

1. **Webinars → New webinar** → fill in title/date → Create (this stays DRAFT, no Graph call yet).
2. Open it → **Publish to Teams**. If this succeeds and a join link appears, delegated access + licensing are both working.
3. Register a test attendee via the public registration link on that webinar.
4. After the webinar time passes, click **Sync attendance** (or wait — it also runs automatically every hour). If attendance rows appear, the Application Access Policy is working too.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Need admin approval" still shows when Bhanu clicks Connect | Step 1/1b not done yet, or consent hasn't propagated | Re-check Step 1b's permission list shows all green; wait a few minutes |
| Connected, but **Publish to Teams** fails with 401 | OAuth was completed with a different account than the organizer | Reconnect, make sure the sign-in is `bhanu.p@invisiedge.com` |
| Connected, publish works, but attendance/registration sync returns 403 | Application Access Policy (Step 2) not granted yet, or still propagating | Re-run Step 2's Grant command; wait up to 30 min |
| "Organizer not licensed" style error on publish | Step 3 license missing | Assign E3/E5/Teams Premium to `bhanu.p@invisiedge.com` |
| Attendance empty right after a webinar ends | Teams hasn't generated the report yet | Wait ~15 minutes, then click Sync attendance again |

---

For the full original setup guide (app registration from scratch, generic
placeholders) see `docs/TEAMS_SETUP.md` — this document only covers what's left
given InvisiEdge's app is already registered.
