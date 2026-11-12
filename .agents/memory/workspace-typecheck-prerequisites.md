---
name: Workspace typecheck prerequisites
description: Distinguishing stale shared declarations from real application type errors.
---

Build referenced shared workspace libraries before relying on an artifact's standalone TypeScript check.

**Why:** Both mobile and API checks have reported missing exports or outdated union members even though the current shared source already defined them. Their project references consumed stale declaration output; rebuilding the dependencies cleared the errors without application-source changes.

**How to apply:** Check current shared source before changing an API or schema to satisfy such an error. Use the workspace's dependency-build sequencing, then rerun the artifact typecheck. Do not commit generated declarations as a workaround.
