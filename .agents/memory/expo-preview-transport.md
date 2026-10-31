---
name: Expo Go preview transport
description: HTTPS transport and evidence boundaries when diagnosing Expo Go timeouts.
---

Do not equate a working browser preview or successful native bundle compilation with a successful launch in Expo Go.

**Why:** Expo SDK 54's CLI can print an `exp://` link even with an HTTPS packager proxy configured. During investigation, the Expo endpoint served HTTPS manifests and bundles while direct HTTP connections failed. The secure Expo Go scheme is `exps://`; the ordinary printed QR may still encode the insecure scheme.

**How to apply:** Check the protocol as well as the hostname, and verify the manifest's device/debugger host belongs to the Expo service rather than the regular website. Supply a secure link or QR when appropriate. Keep development hostnames dynamic. Explicitly distinguish verified server connectivity from an actual phone launch; the secure-link workaround has not yet been confirmed on the user's device.
