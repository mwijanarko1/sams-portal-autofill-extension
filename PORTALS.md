# Portal verification matrix

~~Exact application origins and authenticated test journeys are awaiting SAMS access.~~ Greenwich's exact origin and supervised field inventory are confirmed after merged PR #1. Bangor origin and first-pass field inventory are confirmed 2026-10-08. Campora and Greater Manchester origins/access, plus live CRM-to-portal test journeys, remain pending. Do not guess or broaden production host permissions.

| Portal | Origin confirmed | Personal | Contact | Education | Employment | Fixtures | Status |
|---|---:|---:|---:|---:|---:|---:|---|
| University of Greenwich | Yes (`nelson.gre.ac.uk`) | Partial | Partial | Partial | Partial | None in repo (local tmp only) | PR #1 merged; reviewed map, safety blocks, qualification and phone regressions verified; live CRM-to-portal journey pending |
| University of Greater Manchester | No | Not tested | Not tested | Not tested | Not tested | Missing | Blocked by access |
| Bangor University | Yes (`apps.bangor.ac.uk`) | Mapped | Mapped | Mapped | Mapped | Local inventory only | Origin + selector map in `config/portals/bangor.js`; Programme locked until Personal saved; live CRM Autofill pending. See `docs/history/BANGOR.md` |

For each supervised journey, record the exact origin, page matcher, fields filled, existing values skipped, fields with no CRM value, fields left for manual review, and a sanitized HTML fixture under `fixtures/<portal>/`.

Greenwich verification: 16/16 automated tests and the development build pass. Sanitized saved-form replay in Helium confirms first-row Level, no duplicate qualification on repeat Autofill, and UK phone formatting. This is not a live authenticated CRM-to-portal journey. Non-UK Home Telephone values over 11 characters remain a manual correction/clear step.
