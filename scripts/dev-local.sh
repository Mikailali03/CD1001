#!/bin/bash
# Runs the API, web app and tech portal locally (outside Replit).
#   web:  http://localhost:5173/        (proxies /api and /tech/)
#   tech: http://localhost:5174/tech/
#   api:  http://localhost:8080/api
# Reads env from .env.local at the repo root (see .env.local.example).
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "Missing .env.local. Copy .env.local.example and fill it in." >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source .env.local
set +a

API_PORT=8080
WEB_PORT=5173
TECH_PORT=5174

trap 'kill 0' EXIT INT TERM

PORT=$API_PORT NODE_ENV=development \
  pnpm --filter @workspace/api-server run dev &

PORT=$TECH_PORT BASE_PATH=/tech/ API_PROXY_TARGET=http://localhost:$API_PORT \
  pnpm --filter @workspace/tech-portal run dev &

PORT=$WEB_PORT BASE_PATH=/ API_PROXY_TARGET=http://localhost:$API_PORT \
  TECH_PROXY_TARGET=http://localhost:$TECH_PORT \
  pnpm --filter @workspace/casa-dossier run dev &

wait
