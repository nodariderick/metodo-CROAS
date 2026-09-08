---
name: CROAS OS design tokens and conventions
description: Exact colors, fonts, and dark-mode conventions for all CROAS OS modules — must be consistent across every future task
---

## Design tokens (non-negotiable)
- Background: `#0A0908`
- Panel / card surface: `#131110`
- Gold accent primary: `#D69A21`
- Gold accent bright / hover: `#F0C25C`
- Main text: `#F3ECDD`
- Muted text: `#8A7F6E`
- Border / divider: `#222019`

## Typography
- Headings / logotype: **Bodoni Moda** (serif, opsz 6–96, weights 400 and 600)
- UI / body copy: **IBM Plex Sans** (weights 300, 400, 500, 600)
- Numbers / data / timestamps: **IBM Plex Mono** (weights 400, 500, 600)

## Dark mode
The app is **always dark** — no light mode toggle. The `<html>` element must have class `"dark"` unconditionally. All CSS variables are defined in the `.dark` block in `artifacts/web/src/index.css`.

## Google Fonts import
The `@import url('https://fonts.googleapis.com/...')` must be the **very first line** of `index.css` — before `@import "tailwindcss"` — or PostCSS silently drops it.

**Why:** Consistent visual identity across all six modules. Any new page or module added in Tasks 2–5 must use these exact tokens and font families.
