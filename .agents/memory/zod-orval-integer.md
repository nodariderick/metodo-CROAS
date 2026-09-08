---
name: Zod v3 + Orval integer type issue
description: Orval v8.23+ generates zod.int() for OpenAPI integer types, which doesn't exist in Zod v3 — workaround and detection
---

## Rule
Use `type: number` (not `type: integer`) in all OpenAPI spec fields. Also replace `type: ["integer", "null"]` with `type: ["number", "null"]` for nullable integer fields.

**Why:** Orval v8.23.0 generates `zod.int()` for `type: integer` fields. `zod.int()` is a Zod v4 method that does not exist in Zod v3 (`^3.x`). The workspace catalog pins Zod at `^3.25.76`. The typecheck after codegen fails with `Property 'int' does not exist on type 'typeof import("...zod/index")'`.

**How to apply:** Any time you write or update `lib/api-spec/openapi.yaml`, scan for `type: integer` and `type: ["integer", "null"]` and replace them with `type: number` and `type: ["number", "null"]`. Run `sed -i 's/type: integer/type: number/g'` and `sed -i 's/type: \["integer", "null"\]/type: ["number", "null"]/g'` after writing the spec as a safety net before running codegen.
