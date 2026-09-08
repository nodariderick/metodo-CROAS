---
name: Production session tests
description: How to exercise production-mode secure session cookies from a local integration-test process.
---

Production-mode authentication integration tests that call the API process over local HTTP must send `X-Forwarded-Proto: https`.

**Why:** The app trusts the Replit reverse proxy and configures production session cookies as secure. Without the forwarded protocol header, Express correctly treats the direct local request as insecure and does not issue the cookie, causing a misleading test failure.

**How to apply:** Whenever a test starts the production API locally and expects a session cookie, include the forwarded HTTPS header while keeping the production cookie settings unchanged.