---
name: Expo Go preview handshake
description: Native manifest signing requests, optional login prompts, and HTTPS transport when diagnosing phone timeouts.
---

Do not equate a working browser preview or successful native bundle compilation with a successful launch in Expo Go.

**Why:** An ordinary JSON manifest request returned immediately, but requesting it with Expo Go's `expo-expect-signature` header stalled at an interactive CLI login prompt. With an EAS project configured and no CLI session, SDK 54 tries to obtain a development signing certificate before replying. Browser and basic bundle checks missed that native-only branch. The user confirmed that changing to the secure QR alone did not solve the timeout.

**How to apply:** Include `expo-platform: ios`, `expo-protocol-version: 1`, `expo-expect-signature: keyid="expo-root",alg="rsa-v1_5-sha256"` and multipart acceptance when checking startup. For SDK 54, Expo's supported `--offline` development mode avoids optional certificate fetching and the prompt; app networking and production signing remain unchanged. Do not combine `--offline` with `--localhost`, which the CLI rejects. Keep explicit dependency validation separate because offline startup skips that check.

**SDK boundary:** This is not a workaround for Expo Go 57's required managed sign-in. On SDK 57 upgrades, follow the Expo skill's managed authentication instructions rather than carrying this flag forward blindly.

**Transport:** The CLI can also print an `exp://` link for an HTTPS packager proxy. The secure Expo Go scheme is `exps://`. Verify native/debugger hostnames belong to the Expo service, keep hosts dynamic, and distinguish successful handshake/bundle responses from a confirmed device launch.
