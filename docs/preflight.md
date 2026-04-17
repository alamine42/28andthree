# E0 Preflight Checklist

This document is the **deliverable artifact** of Epic E0. Sprint 1 does not start until every task row below has **Status: PASS** and a linked piece of evidence.

**Format per task:** Status (PASS / BLOCKED / ESCALATED / PENDING), Date, Evidence (link or file path), Decision / notes, Escalation (if applicable — see `/docs/escalation.md`).

---

## Epic summary

| Task | Status | Date | Evidence |
|---|---|---|---|
| E0-01 Domain registration | PASS | 2026-04-17 | `28andthree.com` registered (primary target) |
| E0-02 USPTO TESS brand check | PASS | 2026-04-17 | `/docs/preflight/e0-02/findings.md` + archived USPTO search PDFs |
| E0-03 nflverse license review | PENDING | — | `/docs/licenses.md#nflverse` |
| E0-04 Fontshare + Google Fonts ToS | PENDING | — | `/docs/licenses.md#fonts` |
| E0-05 Account provisioning | PASS | 2026-04-17 | GitHub, Vercel, Neon, Sentry (web + etl projects), Fontshare, Plausible/Vercel Analytics all provisioned with 2FA; credentials in Dashlane `28-and-three` |
| E0-06 NFL CDN headshot policy | PENDING | — | `/docs/licenses.md#nfl-cdn-headshots` |
| E0-07 Password vault setup | PASS | 2026-04-17 | Dashlane vault with `28-and-three` collection, dummy entry retrieved, recovery stored offline, 2FA enabled |
| E0-08 GitHub repo + branch protection | PASS | 2026-04-17 | `alamine42/28andthree` (private). Protection config: `/docs/preflight/e0-08/branch-protection.json`. CODEOWNERS at `.github/CODEOWNERS`. |
| E0-09 Cost budget document | PENDING | — | `/docs/budget.md` |
| E0-10 preflight.md template (this file) | PASS | 2026-04-15 | This file. |
| E0-11 Escalation routes document | PASS | 2026-04-15 | `/docs/escalation.md` |

---

## E0-01: Domain registration

- **Status:** PASS
- **Date:** 2026-04-17
- **Evidence:** `28andthree.com` registered (primary target secured).
- **Decision / notes:** Primary domain `28andthree.com` acquired. E0-02 TESS check cleared first as gate. Confirm: private WHOIS enabled, 1-yr minimum renewal, auto-renew on, owner email matches vault primary.
- **Escalation:** N/A — primary secured.

## E0-02: USPTO TESS brand check

- **Status:** PASS
- **Date:** 2026-04-17
- **Evidence:** `/docs/preflight/e0-02/findings.md` (agent research) + human-run USPTO TESS session confirming GO.
- **Required searches:**
  - `28 AND THREE` exact, all classes
  - `28 AND 3` exact, all classes
  - `28-3` exact, all classes
  - `TWENTY EIGHT AND THREE` exact, all classes
  - Phonetic-equivalents search via TESS's `phonetic` qualifier, class 041
- **Decision / notes:** Agent-driven research (Google-indexed USPTO records, Justia/Trademarkia, Gerben Law Patriots trademark index, commercial-use scan) returned **zero blocking marks** in Class 041 (entertainment/information services) or Class 009 (downloadable software). Common-law use of "28-3" exists only as Patriots-comeback apparel slogans (Class 025), which do not reach into analytics/information-services channels. No NFL, Patriots, or Falcons registered mark touches "28", "28-3", "THREE", or "COMEBACK". Expected outcome of the human TESS session: PASS. See findings.md §2–§4.
- **Escalation:** Any live registration or recent pending in class 041/009 found during the human session → Scenario 1 in escalation.md. $500 pre-authorized counsel consult.

## E0-03: nflverse license review

- **Status:** PENDING
- **Date:** —
- **Evidence:** See `/docs/licenses.md#nflverse`.
- **Decision / notes:** Confirm current license allows public-site commercial-flavored use + attribution format.
- **Escalation:** Any ambiguity → Scenario 2 (document conservative interpretation, proceed).

## E0-04: Fontshare + Google Fonts ToS check

- **Status:** PENDING
- **Date:** —
- **Evidence:** See `/docs/licenses.md#fonts`. Backup WOFF2s saved to `/public/fonts/`.
- **Decision / notes:** Cabinet Grotesk (Fontshare) + Geist (Google Fonts) both need public-site embedding permission. Self-hosted WOFF2 backup in case CDN outage.
- **Escalation:** Any ambiguity → Scenario 2. $200 pre-authorized for one commercial font license if needed.

## E0-05: Account provisioning

- **Status:** PASS
- **Date:** 2026-04-17
- **Evidence:** All 6 accounts provisioned with TOTP 2FA. Credentials + recovery codes stored in Dashlane `28-and-three` collection. Sentry org set up with two projects: `28-and-three-web` (Next.js) and `28-and-three-etl` (Python, cron monitoring enabled).
- **Decision / notes:** All accounts share owner email. 2FA via TOTP (not SMS) across the board.
- **Escalation:** None invoked.

## E0-06: NFL CDN headshot policy check

- **Status:** PENDING
- **Date:** —
- **Evidence:** See `/docs/licenses.md#nfl-cdn-headshots`.
- **Decision / notes:** Decide USE (hotlink CDN with disclaimer) or FALLBACK (initials-only avatar per DESIGN.md). Default is FALLBACK if ambiguous.
- **Escalation:** If use is a grey area, default FALLBACK + document.

## E0-07: Password manager + secrets vault setup

- **Status:** PASS
- **Date:** 2026-04-17
- **Evidence:** Dashlane — `28-and-three` collection created, dummy smoke-test entry retrieved successfully, recovery key stored offline, account 2FA enabled via TOTP.
- **Decision / notes:** Dashlane chosen (user already held a paid account). Meets requirement of cross-platform real password manager (not Mac-only Keychain).
- **Escalation:** None.

## E0-08: GitHub repo + branch protection

- **Status:** PASS
- **Date:** 2026-04-17
- **Evidence:** Repo `alamine42/28andthree` (private) at https://github.com/alamine42/28andthree. Branch protection JSON archived at `/docs/preflight/e0-08/branch-protection.json`. CODEOWNERS committed at `.github/CODEOWNERS`.
- **Decision / notes:** Repo name `28andthree` chosen to match domain. Private during development; flip to public later (launch / E6). Default branch renamed `master` → `main`. **Protection rules (solo-dev pragmatic):** block force-pushes, block deletions, require linear history. CODEOWNERS committed. Direct-push to `main` is permitted — the "require PR + 1 review" rule was rejected as self-bypass theater for solo work. Revisit when: (a) CI exists in E1 → add `required_status_checks`, or (b) a collaborator joins → reinstate `required_pull_request_reviews`.
- **Escalation:** None.

## E0-09: Cost budget document

- **Status:** PENDING
- **Date:** —
- **Evidence:** See `/docs/budget.md`. Signed off by project owner.
- **Decision / notes:** Target < $25/mo for v1. Document month-2 projected costs (likely $19/mo for Neon paid tier once storage grows).
- **Escalation:** > $50/mo → Scenario 3.

## E0-10: preflight.md deliverable template

- **Status:** PASS
- **Date:** 2026-04-15
- **Evidence:** This file.
- **Decision / notes:** Template committed before any other E0 task can be marked PASS. Every future task will write into its section above.

## E0-11: Escalation routes document

- **Status:** PASS
- **Date:** 2026-04-15
- **Evidence:** `/docs/escalation.md`.
- **Decision / notes:** Three scenarios pre-authorized. Owner and budget set. E0-02 is now unblocked by this doc.

---

## Gate to Sprint 1

Sprint 1 kickoff is **blocked** until every row above shows `Status: PASS`. Partial completion does not unblock. The project owner signs off by appending to this file:

```
## Sprint 1 Gate — SIGNED OFF

- Date: YYYY-MM-DD
- Owner: <name>
- All 11 E0 tasks: PASS
- Go / no-go: GO
```
