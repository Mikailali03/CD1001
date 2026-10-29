# Casa Dossier

pnpm workspace monorepo (Node 24, pnpm 10, TypeScript 5.9): Express 5 API, a React and Vite web app, an Expo mobile app and the CasaService technician portal, with Postgres through Drizzle and Clerk auth.

See [README.md](./README.md) for packages, commands, environment variables and deployment notes. See the `pnpm-workspace` skill for workspace and TypeScript setup details.

## Replit-specific notes

- Clerk app ID: `app_3DBzSElFu5UTNr7QbjMwITkmF83`. `VITE_CLERK_PROXY_URL` is injected only in production; leave it empty in dev.
- Artifact routing lives in `artifacts/*/.replit-artifact/artifact.toml`.
- `scripts/post-merge.sh` runs `pnpm install --frozen-lockfile` and `db push` after merges.
