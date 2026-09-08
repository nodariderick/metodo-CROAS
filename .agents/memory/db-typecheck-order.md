---
name: DB lib stale declarations — typecheck ordering
description: After changing lib/db schema files, always rebuild lib declarations before typechecking artifacts
---

## Rule
After editing any file under `lib/db/src/schema/`, run `pnpm run typecheck:libs` before running `pnpm --filter @workspace/<artifact> run typecheck`.

**Why:** `lib/db` is a composite TypeScript project that emits declarations. Artifacts import from `@workspace/db`. If the lib declarations are stale (not rebuilt after a schema change), artifact typechecks fail with `Module '"@workspace/db"' has no exported member 'tableXyz'` — even though the source is correct. The fix is to rebuild the declarations first.

**How to apply:** In any build sequence that touches `lib/db/src/schema/`, always insert `pnpm run typecheck:libs` before the artifact typecheck step.
