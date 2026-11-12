# Casa Dossier

Casa Dossier is a "Carfax for homes." Every property has a dossier: the systems and appliances in it, when each was serviced, what is due next, and what it will cost to replace. The record moves with the house when it is sold.

Main features:

- **Property and asset dossier.** Properties, their assets (HVAC, water heater, roof, appliances and so on), with AI photo scans that identify an asset from its label.
- **Maintenance inbox.** Recurring maintenance tasks generated from built-in specs, plus email and push reminders when tasks come due.
- **Service history.** A log of every service record per asset.
- **Capital outlook.** Projected replacement timing and cost for major systems.
- **Ledger.** An investment ledger of money spent on the home.
- **Digital locker.** Uploaded documents such as warranties, manuals, receipts and permits, stored in object storage.
- **Deed transfer.** Hand the full dossier to a new owner through a claim link.
- **CasaService.** Casa Dossier's own Atlanta-area service team. Homeowners in the service area request service, the team is notified, and technicians (access granted by an admin) take jobs in a separate portal. Homeowners outside the area can join a waitlist.

## Packages

This is a pnpm workspace monorepo.

| Package | Path | What it does |
|---|---|---|
| `@workspace/api-server` | `artifacts/api-server` | Express 5 API. It handles Clerk auth, Stripe checkout and webhooks, the scheduled jobs (reminders, monthly tips) and the AI routes. It is bundled with esbuild and serves `/api`. |
| `@workspace/casa-dossier` | `artifacts/casa-dossier` | Homeowner web app built with React, Vite, Tailwind v4, shadcn/ui and Wouter. It serves `/`. |
| `@workspace/casa-dossier-mobile` | `artifacts/casa-dossier-mobile` | Homeowner mobile app built with Expo and React Native using expo-router. It serves `/mobile/` in Replit. |
| `@workspace/tech-portal` | `artifacts/tech-portal` | CasaService technician portal (React and Vite) with a job map, my jobs and profile setup. It serves `/tech/`. |
| `@workspace/db` | `lib/db` | Drizzle ORM schema and Postgres client. |
| `@workspace/api-spec` | `lib/api-spec` | The OpenAPI spec (`openapi.yaml`) plus the Orval config that generates the two packages below. |
| `@workspace/api-zod` | `lib/api-zod` | Generated Zod schemas, used by the server for validation. |
| `@workspace/api-client-react` | `lib/api-client-react` | Generated React Query hooks, used by the web, mobile and tech portal apps. |
| `@workspace/maintenance-specs` | `lib/maintenance-specs` | The built-in maintenance task specs per asset category, shared by the web and mobile apps. |
| `@workspace/integrations-openai-ai-server` | `lib/integrations-openai-ai-server` | Server-side OpenAI client (chat, image, audio, batch). Reads `OPENAI_API_KEY`, or the Replit AI Integrations variables, and is created on first use so the server boots without a key. |
| `@workspace/object-storage-web` | `lib/object-storage-web` | Uppy-based upload helpers for object storage. No app imports it at the moment. |
| `@workspace/scripts` | `scripts` | One-off scripts: Stripe product seeding and an owner-email backfill. |

## Prerequisites

- Node.js 24
- pnpm 10. Other package managers are rejected by a `preinstall` guard.
- PostgreSQL 16, available through `DATABASE_URL`

## Setup

```sh
pnpm install
pnpm --filter @workspace/db run migrate   # create or update tables
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/casa-dossier run dev
```

To run everything outside Replit, copy `.env.local.example` to `.env.local`, fill it in, and run `./scripts/dev-local.sh` (API, web app and tech portal) and `./scripts/dev-mobile-local.sh` (Expo, for the iOS Simulator or a device on the same Wi-Fi).

Each app reads `PORT` (and `BASE_PATH` for the Vite apps) from the environment. Replit sets both through each artifact's `.replit-artifact/artifact.toml`. When running locally, set them yourself, for example `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/casa-dossier run dev`.

## Key commands

| Command | What it does |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm run typecheck` | `tsc --build` over the composite libs, then each artifact's and `scripts`' own `typecheck` |
| `pnpm run build` | Typecheck, then build every package that has a `build` script |
| `pnpm --filter @workspace/api-server test` | API server tests (Vitest) |
| `pnpm --filter @workspace/db run migrate` | Apply pending migrations from `lib/db/migrations`. On a database created with `push` before migrations existed, it first records the baseline as applied. |
| `pnpm --filter @workspace/db run generate --name <change>` | After editing `lib/db/src/schema`, write a new migration for the change. Commit it with the schema change. |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate `api-zod` and `api-client-react` from `openapi.yaml` |
| `pnpm --filter @workspace/scripts run seed-products` | Create the Stripe subscription products and prices (idempotent, needs `STRIPE_SECRET_KEY`) |
| `pnpm --filter @workspace/scripts run backfill-owner-email` | Backfill property owner emails from Clerk |

## Environment variables

### API server (`artifacts/api-server`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Required, because `@workspace/db` throws at import if it is missing. |
| `PORT` | Port to listen on. Required. |
| `NODE_ENV` | `development` or `production` |
| `LOG_LEVEL` | Pino log level (default `info`) |
| `CLERK_SECRET_KEY` | Clerk server key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key, used by the server middleware and the Clerk proxy |
| `ADMIN_EMAIL` | The user with this email gets the admin role when their profile is bootstrapped. New ownership claims and new CasaService requests are also emailed here. |
| `DEMO_TOKEN` | Token that grants the read-only demo session. Demo mode is off unless it's set. It must match the web app's `VITE_DEMO_TOKEN`. The first demo request seeds a sample home (`lib/demo.ts`), and the demo sees Basic features such as Capital Outlook. |
| `STRIPE_SECRET_KEY` | Stripe API key, used for checkout, the billing portal and subscription sync |
| `STRIPE_WEBHOOK_SECRET` | Signing secret used to verify `POST /api/stripe/webhook` |
| `RESEND_API_KEY` | Resend API key for transactional email (reminders, reports, transfers). Optional on Replit: without it, email goes through the Replit Resend integration. Off Replit, email is skipped (logged) unless it is set. |
| `CARTO_API_KEY` | CARTO basemap key for the tech portal map. Tiles are proxied through `GET /api/maps/tiles/:z/:x/:y` so the key stays on the server; without it the endpoint returns 503. |
| `EMAIL_FROM` | Sender address for outgoing email (default `Casa Dossier <no-reply@notifications.casadossier.com>`, verified in Resend) |
| `CRON_SECRET` | Shared secret for `POST /api/internal/run-scheduled-jobs`, sent in the `x-cron-secret` header. If it is unset, the endpoint returns 404. |
| `SCHEDULE_TIMEZONE` | IANA timezone the scheduler uses for reminders and tips (default `America/New_York`) |
| `SERVICE_AREA` | CasaService service area as `<lat>,<lng>,<radiusMiles>[,<name>]` (default `33.749,-84.388,50,Atlanta area`). The API rejects service requests from homes outside it, and the technician map and apps read it from `GET /api/service-area`. |
| `CORS_ALLOWED_HOSTS` | Extra comma-separated hostnames allowed by CORS, added to the Replit domains |
| `REPLIT_DOMAINS` | Set by Replit. Used for the CORS allow-list and as the host in Stripe redirect URLs. |
| `REPLIT_DEV_DOMAIN` | Set by Replit. Dev domain, allowed by CORS. |
| `OPENAI_API_KEY` | OpenAI API key. Optional: without a key (here or in the Replit variable below) the server still boots, and AI scans, plans and scout answer 503. |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL. Optional (defaults to OpenAI). |
| `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` | Set by Replit AI Integrations. Used when the `OPENAI_*` variables aren't set. |
| `RENTCAST_API_KEY` | RentCast API key for property lookups ("scout") and the admin property-data refresh |
| `RENTCAST_DAILY_LIMIT` | App-wide daily cap on user-triggered RentCast calls (default `1000`). Per-user limits also apply. |
| `STORAGE_DRIVER` | Where files are stored: `replit` (the Replit sidecar, default on Replit), `gcs` (Google Cloud Storage directly, default when Google credentials are set) or `local` (disk, default in development). Production with none of these configured fails on the first file request. |
| `GOOGLE_APPLICATION_CREDENTIALS` | `gcs` driver: path to a service-account key file. Alternatively `GCS_CREDENTIALS_JSON` holds the key JSON inline, or the host's default credentials are used. The account needs object read/write and must be able to sign URLs. |
| `GCS_PROJECT_ID` | `gcs` driver: Google Cloud project, if it can't be inferred from the credentials |
| `LOCAL_STORAGE_DIR` | `local` driver: directory for files (default `.local-storage` in the API's working directory) |
| `LOCAL_STORAGE_SECRET` | `local` driver: key that signs upload URLs. Optional; without it, unused upload URLs stop working when the server restarts. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Comma-separated `/<bucket>/<dir>` paths for public assets (default `/local/public` with the `local` driver) |
| `PRIVATE_OBJECT_DIR` | `/<bucket>/<dir>` path for private uploads such as locker documents and photos (default `/local/private` with the `local` driver) |

### Web app and tech portal (`artifacts/casa-dossier`, `artifacts/tech-portal`)

| Variable | Purpose |
|---|---|
| `PORT` | Vite dev or preview port. Required. |
| `BASE_PATH` | Base path the app is served from (`/` or `/tech/`). Required. It is exposed to the app as `import.meta.env.BASE_URL`. |
| `REPL_ID` | Set by Replit. Turns on the Replit-only Vite plugins (cartographer, dev banner). |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `VITE_CLERK_PROXY_URL` | Clerk proxy URL. Replit injects it in production; leave it empty in dev. |
| `VITE_DEMO_TOKEN` | Web only. The demo-session token (must match the server's `DEMO_TOKEN`). When unset, the demo and the landing page's "See Demo" button are hidden. |

### Mobile app (`artifacts/casa-dossier-mobile`)

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_DOMAIN` | Host of the API the app calls |
| `EXPO_PUBLIC_REPL_ID` | Repl ID, embedded in builds |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `PORT`, `BASE_PATH` | Expo dev server port and base path |
| `REPLIT_DEV_DOMAIN`, `REPLIT_EXPO_DEV_DOMAIN`, `REPLIT_INTERNAL_APP_DOMAIN`, `REPL_ID` | Set by Replit. Used by the `dev` script and `scripts/build.js` to work out public URLs. |

### Scripts (`scripts`)

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Used by `seed-products` |
| `DATABASE_URL`, `CLERK_SECRET_KEY` | Used by `backfill-owner-email` |

## Deploying on Replit

- Each artifact's routing, build and run commands live in `artifacts/*/.replit-artifact/artifact.toml`. The API autoscales.
- **Stripe webhook.** Point a Stripe webhook endpoint at `https://<your-domain>/api/stripe/webhook` and put its signing secret in `STRIPE_WEBHOOK_SECRET`. Subscribe to these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.paused`
  - `customer.subscription.resumed`
- **Scheduled jobs.** The autoscaled API can scale to zero, so its in-process scheduler can't be relied on. Set up an hourly Replit Scheduled Deployment, or any external cron, that calls:

  ```sh
  curl -fsS -X POST "https://<your-domain>/api/internal/run-scheduled-jobs" -H "x-cron-secret: $CRON_SECRET"
  ```

- **Schema changes.** After changing `lib/db/src/schema`, generate a migration (`run generate`) and commit it. Run `pnpm --filter @workspace/db run migrate` against the production database when deploying. `scripts/post-merge.sh` runs it for the dev database after a merge.
- Run `seed-products` once per Stripe account (test and live).

## Note on native binaries

The `overrides` in `pnpm-workspace.yaml` strip the platform-specific native binaries of esbuild, rollup, lightningcss and tailwind oxide for every platform except Linux x64 (glibc), which is what Replit runs, and darwin-arm64. As a result, the repo installs on Replit and on Apple Silicon Macs but not on Intel Macs or Windows. To support another platform, remove its line from `overrides`. The `@expo/ngrok` binaries are stripped on every platform except Linux x64, so `expo start --tunnel` doesn't work on a Mac.
