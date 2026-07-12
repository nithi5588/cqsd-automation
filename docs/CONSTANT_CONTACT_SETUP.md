# Constant Contact (API v3) — Step-by-Step Setup

This connects the dashboard to Constant Contact so it can push contacts/segments,
create and schedule campaigns, and — most importantly — pull back **who opened and
who clicked every email**, per contact and rolled up per company, automatically.

## Step 1 — Create a developer app

1. Go to https://developer.constantcontact.com and sign in with the Constant
   Contact account that sends your campaigns (the CompQsoft account).
2. Open **My Applications** → **New Application**.
3. Name: `CQSD Marketing Dashboard`.
4. Auth flow: choose **Authorization Code Flow and Implicit Flow** (we use
   authorization code + refresh tokens).
5. Click **Create**. On the app page:
   - **API Key** → this is your `CC_CLIENT_ID`
   - If the app offers **Generate Secret**, you may copy it into `CC_CLIENT_SECRET` —
     but this is **optional**. Apps created without a secret (API key only) work fine:
     the dashboard automatically uses the PKCE flow instead. Leave
     `CC_CLIENT_SECRET=` empty in that case.
6. Add the **Redirect URI**: `http://localhost:3000/oauth/constant-contact/callback`
   (add your production callback later, exactly matching `CC_REDIRECT_URI`).

## Step 2 — Fill `.env`

```env
CC_CLIENT_ID=<API Key>
CC_CLIENT_SECRET=            # empty is fine — PKCE is used when no secret exists
CC_REDIRECT_URI=http://localhost:3000/oauth/constant-contact/callback
CC_SCOPES=contact_data campaign_data account_read offline_access
```

The scopes mean: manage contacts/lists, manage + report on campaigns, read account
info, and get a refresh token so the connection survives without re-login.

## Step 3 — Connect in the dashboard (once)

1. Restart the API (`bun run dev`).
2. Dashboard → **Connections** → **Constant Contact** → **Connect**.
3. Log in and approve. The dashboard stores the tokens encrypted and auto-refreshes
   them from then on (Constant Contact rotates refresh tokens — the backend persists
   each new one automatically).

## Step 4 — Verify the flow, end to end

1. **Contacts** → import or add a few contacts (with company + persona).
2. **Segments** → create a segment (by industry / AE / persona) → **Sync to
   Constant Contact**. This creates a CC list and bulk-imports the members.
3. **Campaigns** → New campaign (subject, from name/email, HTML content, pick the
   segment) → **Push to Constant Contact** → **Send test** to yourself →
   **Schedule** (or schedule all weekly volumes).
4. After sends go out, stats sync automatically every 10 minutes (or click
   **Sync stats now** on the campaign page). You'll see:
   - **KPIs**: sends, unique opens, unique clicks, bounces, opt-outs
   - **By contact**: who opened / who clicked, how many times, first-open time
   - **By company**: the same rolled up per account — this feeds Account Plans
5. Hard bounces are removed from your segments automatically after each sync, so
   list hygiene / domain reputation is handled without manual cleanup.

## Notes & limits

- The refresh token only exists after the one-time OAuth in Step 3 — env keys alone
  are not enough; someone must click Connect once.
- If the connection card ever shows **Expired** (e.g. the secret was regenerated or
  access revoked), just click **Reconnect**.
- Rate limits: Constant Contact throttles bursts; the sync client retries with
  backoff automatically. Very large accounts may take a couple of sync cycles to
  fully backfill per-contact activity.
