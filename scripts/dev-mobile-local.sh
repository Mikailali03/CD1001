#!/bin/bash
# Runs the Expo mobile app locally (outside Replit) for Expo Go on a phone.
# The package's own `dev` script depends on Replit domains, so it can't be used here.
# Start the API first (scripts/dev-local.sh); the phone must be on the same Wi-Fi.
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

LAN_IP="${LAN_IP:-$(ipconfig getifaddr en0 || ipconfig getifaddr en1 || true)}"
if [ -z "$LAN_IP" ]; then
  echo "Couldn't detect your LAN IP. Run with LAN_IP=<your Mac's IP> $0" >&2
  exit 1
fi
echo "Mobile app will call the API at http://$LAN_IP:8080"

cd artifacts/casa-dossier-mobile
# Expo CLI calls api.expo.dev on startup (version checks, manifest signing). On networks
# with TLS-intercepting proxies that fails with "TypeError: fetch failed" and Metro exits.
# Offline mode skips those calls; Expo Go still loads the app over the LAN.
# Set EXPO_OFFLINE=0 to go back online.
EXPO_OFFLINE="${EXPO_OFFLINE:-1}" \
  EXPO_PUBLIC_DOMAIN="http://$LAN_IP:8080" \
  EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY" \
  REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP" \
  exec pnpm exec expo start --lan --port 8081 "$@"
