---
name: Google OAuth callback URL detection
description: How the CROAS OS API server determines the Google OAuth callback URL at startup
---

## Rule
The Google OAuth callback URL is auto-detected in `artifacts/api-server/src/lib/passport.ts` — do not hardcode it.

**Why:** The Replit preview domain changes between sessions and differs between dev and production. The detection logic reads `REPLIT_DOMAINS` (comma-separated production/preview domains) first, then falls back to `REPLIT_DEV_DOMAIN`, then to localhost. This means the OAuth callback always points to the correct public URL without manual configuration.

**How to apply:** When updating or adding OAuth strategies, follow the same pattern — read `process.env.REPLIT_DOMAINS?.split(",")[0]` for the base domain, not `REPLIT_DEV_DOMAIN` (which is dev-only). The user must add the detected callback URL to their Google Cloud Console's Authorized Redirect URIs.
