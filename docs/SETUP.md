# Setup

Values go in `.env.local` (or `.env`) at the project root. Both are gitignored, so never commit them. `.env.example` lists every key with no values.

When both files define a key, `.env.local` wins, **even if its value is empty**. Don't leave blank placeholder lines in `.env.local` for keys you've set in `.env`.

| Variable | Needed for | Where it comes from |
|---|---|---|
| `DATABASE_URL` | Everything behind sign-in | AWS RDS Postgres (step 1) |
| `AUTH_SECRET` | Sign-in | Generate it (step 2) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | "Continue with Google" | Google Cloud Console (step 3) |
| `AUTH_RESEND_KEY` (or `RESEND_API_KEY`), `AUTH_EMAIL_FROM` | Email sign-in links | Resend (step 4) |
| `OPENROUTER_API_KEY` | Real videos from web sources | OpenRouter (step 5). Without it, demo mode |
| `POLIVID_MODEL` | Optional | Any OpenRouter model slug. Default `anthropic/claude-opus-5.5` |

After changing `.env.local`, restart `npm run dev`.

## 1. Database (AWS RDS Postgres)

PoliVid uses Postgres on **AWS RDS**: always on, with no cold starts. Estimated cost is about $18/month (instance ~$12, 20 GB storage ~$2.30, public IPv4 address ~$3.60). That's an estimate from us-east-1 list prices, so check the AWS pricing page.

### Create the instance (AWS console, about 10 minutes)

1. Open **RDS** in region **us-east-1 (N. Virginia)**, which matches Vercel's default region. Click **Create database**.
2. Choose the full/standard configuration (not "Easy create"). Engine **PostgreSQL**, latest version offered.
3. Template **Dev/Test** (or Free tier if offered). Deployment **Single-AZ DB instance**.
4. Settings:
   - Instance identifier `polivid`.
   - Master username `postgres_admin`.
   - Credentials **self-managed** with a strong password, saved in your password manager. Avoid Secrets Manager rotation: it would change the password under `DATABASE_URL`.
5. Instance class **db.t4g.micro**.
6. Storage:
   - **gp3**, 20 GiB.
   - Turn on storage autoscaling with a 50 GiB maximum.
7. Connectivity:
   - Don't connect an EC2 resource. Use the default VPC.
   - **Public access: Yes**.
   - New security group `polivid-db`, port 5432.
8. Monitoring: leave Enhanced Monitoring off; it costs extra.
9. Additional configuration:
   - Leave "Initial database name" empty; the next section creates it.
   - Backups: 7 days.
   - Encryption: on.
   - **Deletion protection: on**.
   - Auto minor version upgrade: on.
10. Create, then wait until the status is **Available**.

### Open the firewall

1. Go to RDS > Databases > polivid > Connectivity & security, and click the security group.
2. Add an inbound rule: PostgreSQL (5432) from **My IP**.

That's enough for local development. When we deploy to Vercel, the rule has to allow `0.0.0.0/0`, because Vercel's servers don't have fixed IPs. That's acceptable because of the SSL requirement, the dedicated app user and the strong password below. RDS for PostgreSQL 15+ requires SSL by default (`rds.force_ssl = 1`); check the parameter group if you picked an older version.

### Create the app user and database

The database and app user are named `politivid` / `politivid_app`. They were created before the product was renamed to PoliVid, and they stay as they are: they're internal, and renaming them would mean taking the app offline for nothing.

The app shouldn't connect as the admin user.

1. Copy the **Endpoint** from Connectivity & security.
2. Generate a password with no URL-special characters:

   ```bash
   openssl rand -base64 32 | tr -d '/+='
   ```

3. Connect as the admin (`psql` is already installed through Homebrew):

   ```bash
   psql "host=<endpoint> port=5432 dbname=postgres user=postgres_admin sslmode=require"
   ```

4. Run:

   ```sql
   CREATE ROLE politivid_app LOGIN PASSWORD '<app password>';
   GRANT politivid_app TO postgres_admin;  -- RDS admin isn't superuser; needed to assign ownership
   CREATE DATABASE politivid OWNER politivid_app;
   ```

### Connect the app

In `.env.local`:

```
DATABASE_URL=postgresql://politivid_app:<app password>@<endpoint>:5432/politivid?sslmode=require&connection_limit=5&pool_timeout=20
```

- `sslmode=require` encrypts the connection.
- `connection_limit=5` caps how many connections each server instance opens. A db.t4g.micro allows roughly 80–100 connections in total, so this leaves room for about 15–20 concurrent Vercel function instances. If traffic outgrows that, add RDS Proxy (roughly $20/month more, estimated).

Then create the tables:

```bash
npm run db:push
```

`prisma/schema.prisma` holds the Auth.js tables (User, Account, Session, VerificationToken) and the `Video` table. Once the schema stops changing every day, switch from `db:push` to `db:migrate` so changes are recorded as migrations.

**Local development without AWS (optional):** any Postgres works, for example `postgresql://postgres:postgres@localhost:5432/politivid` from Homebrew or Docker.

## 2. AUTH_SECRET

This signs Auth.js cookies and tokens. If `.env.local` was created for you, it's already set. Otherwise:

```bash
openssl rand -base64 33
```

Use a different secret in production.

## 3. Google sign-in

1. Go to [Google Cloud Console](https://console.cloud.google.com/) > APIs & Services.
2. **OAuth consent screen:** set the app name (PoliVid), a support email and authorized domains. While it's in **Testing**, only the test users you add can sign in.
3. **Credentials:** Create credentials > OAuth client ID > **Web application**.
   - **Authorized JavaScript origins:** `http://localhost:3100`
   - **Authorized redirect URIs:** `http://localhost:3100/api/auth/callback/google`
   - For production, add `https://polivid.io` and `https://polivid.io/api/auth/callback/google`.
   - Leave "Use this client for an AI-powered agent" unchecked.
4. Copy the Client ID into `AUTH_GOOGLE_ID` and the Client secret into `AUTH_GOOGLE_SECRET`.

Google can take a few minutes to apply changes to an OAuth client.

## 4. Email sign-in (Resend)

1. In [Resend](https://resend.com/), go to Domains > Add domain and add the DNS records it shows. Wait until the domain is **Verified**.
2. Go to API Keys > Create API key, with "Sending access" permission. Put it in `AUTH_RESEND_KEY` (`RESEND_API_KEY` also works).
3. Set `AUTH_EMAIL_FROM` to a sender on the verified domain, for example `PoliVid <login@polivid.io>`.

Clicking "Email me a sign-in link" sends a one-time link that's valid for 24 hours. The first sign-in creates the account. If someone uses Google and email with the same address, both land on one account (`allowDangerousEmailAccountLinking` in `auth.ts`; Google verifies emails, so this is safe for Google).

## 5. OpenRouter (video generation)

1. Create a key at [openrouter.ai/keys](https://openrouter.ai/keys) and put it in `OPENROUTER_API_KEY`.
2. Optionally set `POLIVID_MODEL` to a different slug (for example `anthropic/claude-sonnet-5.5` to cut cost). Check quality on a few real topics before switching.

To test generation without the app, database or sign-in, run `npm run try -- "Why sleep matters for memory"`. It prints the facts, their sources, the scene plan and the number-check result.

Generation makes two model calls per video: research with OpenRouter's web plugin, then the scene plan. If the plan fails the number check, it makes one more call to repair it. See [ARCHITECTURE.md](ARCHITECTURE.md#generation-pipeline).

## Troubleshooting

| Symptom | Cause |
|---|---|
| Login page says "Sign-in isn't configured yet" | An `AUTH_*` value is missing or wrong. Check the dev server terminal for the Auth.js error |
| Google says `redirect_uri_mismatch` | The redirect URI in Google doesn't exactly match `http://localhost:3100/api/auth/callback/google` |
| "That email already signed in another way" | Auth.js refused to link accounts (`OAuthAccountNotLinked`) |
| Sign-in email never arrives | The `AUTH_EMAIL_FROM` domain isn't verified in Resend, or check Resend > Logs |
| Every video says "Sample data" | `OPENROUTER_API_KEY` isn't set (demo mode) |
| Prisma "Can't reach database server" | The RDS security group doesn't allow your current IP (it changes on new networks), Public access is off, or `DATABASE_URL` is wrong |
| Prisma "permission denied for schema public" | The tables were created as a user that doesn't own the database. Connect as `politivid_app` (step 1) |
