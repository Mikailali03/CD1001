---
name: Metro install/watch races
description: Distinguishing disappearing pnpm temporary directories from missing app dependencies.
---

Treat Metro ENOENT errors on dependency directories containing `_tmp_` as an installation/file-watcher race, not evidence that the app needs a missing dependency directory restored.

**Why:** This workspace has reproduced the same crash with different packages during shared dependency changes. Creating the missing temporary directory or excluding only one package does not prevent recurrence with another package.

**How to apply:** Keep watcher exclusions scoped to temporary package directories and ensure they match the directory itself as well as descendants. Preserve normal dependency watching and resolution.
