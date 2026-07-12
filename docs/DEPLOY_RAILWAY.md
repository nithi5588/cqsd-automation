# Deploying to Railway (backend + frontend from this one repo)

One repo → **two Railway services** (API and Site) plus the Postgres + Redis you already
have. Railway builds each service from the same GitHub repo with different start
commands. ~20 minutes.

## Step 0 — Push the repo to GitHub (one time)

The repo has no commits yet. From the project folder:

```bash
git add -A
git commit -m "CQSD marketing automation platform"
# create an empty PRIVATE repo on github.com first, then:
git remote add origin https://github.com/<your-username>/cqsd-marketing.git
git push -u origin master
```

`.env` files are gitignored — no secrets get pushed. Verify with `git status` that
no `.env` appears before committing.

## Step 1 — Service 1: the API

In your Railway project (the one with Postgres + Redis): **+ New → GitHub Repo** →
pick the repo. Then in the new service's **Settings**:

| Setting | Value |
|---|---|
| Service name | `api` |
| Build command | `bun install && bun run --cwd packages/db generate` |
| Pre-deploy command | `bunx prisma migrate deploy --schema packages/db/prisma/schema.prisma` |
| Start command | `bun run --cwd packages/api start:prod` |

**Variables** (Settings → Variables) — copy values from your local `.env`, EXCEPT the
two URLs which now use Railway's internal references:

```
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<same as local>
JWT_ISSUER=cqsd-marketing-automation
JWT_AUDIENCE=cqsd-dashboard
ENCRYPTION_KEY=<same as local>
APP_BASE_URL=https://<api-domain>          ← fill in after Step 3
DASHBOARD_BASE_URL=https://<site-domain>   ← fill in after Step 3
CC_CLIENT_ID=70a7a029-ab9c-474f-8cfe-d77eb2e5b65c
CC_CLIENT_SECRET=
CC_REDIRECT_URI=https://<api-domain>/oauth/constant-contact/callback
CC_SCOPES=contact_data campaign_data account_read offline_access
MS_TENANT_ID=<same as local>
MS_CLIENT_ID=<same as local>
MS_CLIENT_SECRET=<same as local>
MS_ORGANIZER_UPN=<organizer mailbox>
MS_REDIRECT_URI=https://<api-domain>/oauth/microsoft/callback
MS_DELEGATED_SCOPES=offline_access VirtualEvent.ReadWrite
MS_TEAMS_ATTENDEE_EMAILS=true
```

`${{Postgres.DATABASE_URL}}` / `${{Redis.REDIS_URL}}` are Railway variable references —
type them exactly like that and Railway wires the internal connection strings.

## Step 2 — Service 2: the Site

**+ New → GitHub Repo** → same repo again. Settings:

| Setting | Value |
|---|---|
| Service name | `site` |
| Build command | `bun install && bun run --cwd public_site build` |
| Start command | `bun run --cwd public_site start:prod` |

**Variables** (needed AT BUILD TIME, so set before the first deploy):

```
NEXT_PUBLIC_API_URL=https://<api-domain>   ← fill in after Step 3, then redeploy
```

## Step 3 — Domains

In each service: **Settings → Networking → Generate Domain**. You'll get e.g.
`cqsd-api-production.up.railway.app` and `cqsd-site-production.up.railway.app`.
Now go back and fill every `<api-domain>` / `<site-domain>` placeholder above,
then **redeploy both services** (the site must rebuild for `NEXT_PUBLIC_API_URL`).

## Step 4 — Update the OAuth apps (one time)

- **Constant Contact** (developer portal → your app): add redirect URI
  `https://<api-domain>/oauth/constant-contact/callback`
- **Microsoft Entra** (App registration → Authentication): add redirect URI
  `https://<api-domain>/oauth/microsoft/callback`

(Keep the localhost ones too so local dev still works.)

## Step 5 — Production data

Wipe the demo data and create a clean admin before real use. From your machine,
with `packages/db/.env` temporarily pointed at the Railway `DATABASE_URL` (public
`proxy.rlwy.net` URL, not the internal one):

```bash
cd packages/db
bunx prisma migrate reset --force        # drops ALL data, re-applies migrations
SEED_SAMPLE_DATA=false bun run seed      # admin user only (set SEED_ADMIN_* first)
```

## Step 6 — Verify

- `https://<api-domain>/health` → `{"status":"ok","database":"ok"}`
- `https://<site-domain>` → login page → sign in
- Connections → Connect Constant Contact (the one-time OAuth, now on the live URL)
- Registration pages become shareable: `https://<site-domain>/register/<slug>`

## Notes

- Both services auto-redeploy on every `git push` to master.
- Background jobs run inside the API service — no third service needed.
- If a build fails with a Bun-not-found error, set the service's builder to
  Nixpacks/Railpack default (it auto-detects `bun.lock`) or add variable
  `NIXPACKS_PKGS=bun`.
- Logs: each service → Deployments → View logs. The API logs every sync job run.
