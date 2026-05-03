# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Clerk (`@clerk/react` on frontend, `@clerk/express` on server)
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui + Lucide-react

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Auth Setup (Clerk)

- Clerk app ID: `app_3DBzSElFu5UTNr7QbjMwITkmF83`
- Env vars: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_CLERK_PROXY_URL` is auto-injected only in production; leave empty in dev
- Frontend: `ClerkProvider` in `App.tsx` with `shadcn` theme, `routing="path"` for SignIn/SignUp
- Server: `clerkMiddleware()` in `app.ts`, proxy middleware in `middlewares/clerkProxyMiddleware.ts`
- Routes: unauthenticated → landing page at `/`; authenticated → redirected to `/dashboard`
- All app routes (`/dashboard`, `/assets`, etc.) are protected with `<Show whenSignedIn>`
- User menu with sign-out in app header (`layout.tsx`)

## Routing

- Uses **Wouter** with `base={basePath}` (basePath = `import.meta.env.BASE_URL` without trailing slash)
- `stripBase()` utility strips basePath from Clerk router callbacks
- Sign-in: `/sign-in/*?`, Sign-up: `/sign-up/*?` with Clerk's `routing="path"`

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
