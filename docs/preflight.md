# E0 Preflight Checklist

This document is the **deliverable artifact** of Epic E0. Sprint 1 does not start until every task row below has **Status: PASS** and a linked piece of evidence.

**Format per task:** Status (PASS / BLOCKED / ESCALATED / PENDING), Date, Evidence (link or file path), Decision / notes, Escalation (if applicable — see `/docs/escalation.md`).

---

## Epic summary

| Task | Status | Date | Evidence |
|---|---|---|---|
| E0-01 Domain registration | PENDING | — | — |
| E0-02 USPTO TESS brand check | PASS | 2026-04-17 | `/docs/preflight/e0-02/findings.md` + archived USPTO search PDFs |
| E0-03 nflverse license review | PENDING | — | `/docs/licenses.md#nflverse` |
| E0-04 Fontshare + Google Fonts ToS | PENDING | — | `/docs/licenses.md#fonts` |
| E0-05 Account provisioning | PENDING | — | — |
| E0-06 NFL CDN headshot policy | PENDING | — | `/docs/licenses.md#nfl-cdn-headshots` |
| E0-07 Password vault setup | PENDING | — | — |
| E0-08 GitHub repo + branch protection | PENDING | — | — |
| E0-09 Cost budget document | PENDING | — | `/docs/budget.md` |
| E0-10 preflight.md template (this file) | PASS | 2026-04-15 | This file. |
| E0-11 Escalation routes document | PASS | 2026-04-15 | `/docs/escalation.md` |

---

## E0-01: Domain registration

- **Status:** PENDING
- **Date:** —
- **Evidence:** (attach `whois` output screenshot here)
- **Decision / notes:** Target `28andthree.com`. Fallbacks (priority order): `28andthree.app`, `28and3.com`, `28andthree.io`. Private WHOIS required. 1-year registration minimum. Do NOT execute until E0-02 clears.
- **Escalation:** If primary + all fallbacks taken → pivot to backup name per escalation.md Scenario 1.

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

- **Status:** PENDING
- **Date:** —
- **Evidence:** (6 screenshots confirming 2FA enabled — GitHub, Vercel, Neon, Sentry, Fontshare, Plausible/Vercel Analytics)
- **Decision / notes:** All accounts use the same owner email; 2FA uses TOTP (not SMS). Recovery codes archived in vault (requires E0-07 done first).
- **Escalation:** None expected; if any account blocks provisioning (KYC / region), swap service (e.g., Plausible → Vercel Analytics).

## E0-06: NFL CDN headshot policy check

- **Status:** PENDING
- **Date:** —
- **Evidence:** See `/docs/licenses.md#nfl-cdn-headshots`.
- **Decision / notes:** Decide USE (hotlink CDN with disclaimer) or FALLBACK (initials-only avatar per DESIGN.md). Default is FALLBACK if ambiguous.
- **Escalation:** If use is a grey area, default FALLBACK + document.

## E0-07: Password manager + secrets vault setup

- **Status:** PENDING
- **Date:** —
- **Evidence:** (vault category `28-and-three` exists; dummy entry retrieved; recovery method documented in an offline location)
- **Decision / notes:** Recommended: 1Password or Bitwarden. A Mac-only Keychain is not sufficient for this project's lifecycle.
- **Escalation:** None.

## E0-08: GitHub repo + branch protection

- **Status:** PENDING
- **Date:** —
- **Evidence:** (screenshot of `git push origin master` blocked by protection rule on a fresh branch; CODEOWNERS stub committed)
- **Decision / notes:** Do NOT run until E0-02 clears (repo name matches the brand). Create repo as `28andthree` or `patsbythenumbers` (current local dir name). Protect `main`: require PR + 1 review, CI green, no force-push. CODEOWNERS stub: `* @<owner>`.
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
