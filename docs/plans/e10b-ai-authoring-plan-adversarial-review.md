# E10b AI Authoring Studio — Adversarial Review

Codex review of `e10b-ai-authoring-plan.md` v1, run 2026-04-27.
Tool: `design-review` (Codex CLI, gpt-5-codex, reasoning effort high).
Output: 2 CRITICAL + 4 WARNINGs + 1 PRAISE.
Verdict: **needs revisions before implementation. Resolve the storage/auth gaps and harden factcheck/UX flows. Confidence: medium.**

All findings adjudicated below. Plan v2 incorporates each one.

---

## CRITICAL #1 — Draft persistence breaks on Vercel

**Codex location:** §3.8 Draft persistence, §3.6 LLM call flow, §2.6 Studio Voice editor

**Finding:** "The plan relies on Server Actions writing markdown files to `drafts/` and even running `git` commits. Vercel's serverless runtime is read-only and ephemeral — writes to the project tree are discarded after the request, and `git` binaries/credentials aren't available. As designed, every draft save/export/commit would silently fail, leaving only the Postgres row and breaking the promised git-versioned archive plus voice-editor workflows."

**Recommendation:** "Move persistence to a durable store that works from Vercel: e.g., store drafts (and prompt files) in Postgres JSON or S3/Supabase, and gate the git-commit workflow behind a local CLI instead of Server Actions. Update L0-08, L0-13, L0-15, and all documentation to reflect the new storage strategy."

**Adjudication:** Accepted in full. This was a foundational error — I lifted the DB+filesystem dual-storage pattern from notaligned (Python+FastAPI on a long-lived host) without re-checking it against Vercel's runtime constraints.

**Plan changes:**

1. `authoring_drafts` schema gains `markdown_content text NOT NULL`. `filepath` and `contentHash` columns dropped.
2. §3.8 rewritten: "Draft persistence — DB only". Saves are atomic Postgres `UPDATE`s.
3. WARNING #3 dissolves automatically (no more dual-write to coordinate).
4. The "git history of drafts" goal preserved as a **separate local CLI workflow**: `pnpm authoring:export` runs locally, pulls `published` drafts from prod DB, writes to `drafts/<content_type>/<slug>.md`. Operator commits the archive periodically. Modeled on `scripts/sandbox-dump.ts`.
5. New task L0-21 added for the export script. Original L0-21 (test gate) renumbered to L0-22.
6. `prompts/*.md` and `AUTHORING.md` remain in repo (read at runtime from the deployed bundle — Vercel ships repo files into the function bundle for read access). They are NOT writable from the running app — see WARNING #1.

**Tasks updated:** L0-01 (schema), L0-08 (persistence), L0-13 (editor save), L0-15 (voice editor — see WARNING #1).

---

## CRITICAL #2 — Cron can't authenticate

**Codex location:** §3.3 Auth middleware, §3.9 Multi-trigger orchestration, L0-17

**Finding:** "`middleware.ts` blocks `/api/authoring/*` unless the caller presents the `28t_admin_session` cookie. GitHub Actions cannot obtain a browser cookie, so every scheduled POST to `/api/authoring/generate` will return 401. The weekly automated pipeline never runs, defeating the core promise of unattended generation."

**Recommendation:** "Introduce a non-cookie auth path for server-to-server callers — e.g., HMAC or PAT header validated inside the middleware — and document how GH Actions supplies it. Update tasks (L0-10/L0-17) to implement and test this path."

**Adjudication:** Accepted in full. v1 was unbuilt-able as written; cron would have failed at first run.

**Plan changes:**

1. §3.3 rewritten: middleware accepts EITHER `Authorization: Bearer <AUTHORING_CRON_TOKEN>` OR `28t_admin_session` cookie. Bad bearer falls through to cookie check (operator with stale curl still gets a useful redirect).
2. New env var `AUTHORING_CRON_TOKEN` — 32-byte random hex, stored in BOTH GH Actions secrets AND Vercel env (operator's middleware checks against the Vercel value; GH Actions sends it).
3. §3.9 adds an explicit workflow YAML sketch. New `/api/authoring/cron-tick` route owns the per-tick orchestration; `/api/authoring/generate` is per-piece. Separation keeps each route focused.
4. L0-10 (auth middleware) acceptance now requires both auth paths working with E2E coverage.
5. L0-17 (cron workflow) acceptance now requires the bearer auth flow.

---

## WARNING #1 — Save-and-commit flow unrealistic

**Codex location:** §2.6 Voice editor, L0-15

**Finding:** "The UI offers 'Save and commit' from the browser, implying a Server Action will stage and commit to the repo. On Vercel there's no persistent git workspace and no push credentials, so the action cannot succeed. Operators will think prompts are versioned when they're not."

**Recommendation:** "Limit in-browser edits to saving in the durable store, and move git commits to a documented local workflow (CLI, pre-push hook, etc.). Remove or replace the button; add a task ensuring version control happens in a viable environment."

**Adjudication:** Accepted. Same root cause as CRITICAL #1.

**Plan changes:**

1. §2.6 rewritten: voice editor is **read-only in v1**. Lists prompt files, renders them, does not allow edit-from-browser.
2. Footer note in voice editor: "To edit: clone the repo, edit the file in your text editor, commit + push. Vercel rebuilds and the studio reads the new content."
3. L0-15 acceptance updated: no save/commit buttons; render-only with raw-source toggle.
4. Future v2 work explicitly noted: if voice-editing-from-browser becomes high-friction after dogfood phase, file a follow-up epic that stores prompts in Vercel Blob / R2 / Postgres bytea with explicit publish flow. Don't pre-build it.

---

## WARNING #2 — Factcheck proper-noun gate would block legit content

**Codex location:** §3.7 Hallucination guard

**Finding:** "The factcheck marks any capitalized token not in `playerNames` or a 'known coach/staff allowlist' as an error. Drafts routinely reference 'Bills,' 'Buffalo,' stadiums, weeks, AFC, etc. — none are in the player list. Approvals will be stuck behind constant 'player_unknown' findings or require manual override, undercutting the guardrail value."

**Recommendation:** "Expand the reference set to include opponent team names, cities, common football nouns, or derive them from source data (schedule metadata). Add regression tests for these cases before enforcing the guard."

**Adjudication:** Accepted. Good catch — v1's heuristic would have generated a flood of false positives on every preview piece.

**Plan changes:**

1. §3.7 rewritten with explicit allowlists in `lib/authoring/factcheck-allowlist.ts`:
   - **Teams**: synthesized from existing `lib/constants/teams.ts` (32 teams + cities + abbreviations)
   - **Coaches**: hand-curated, ~50 entries (HCs + OCs/DCs)
   - **Stadiums**: hand-curated NFL stadiums
   - **Football common nouns**: hand-curated, ~100 entries (positions, divisions, conferences, "Pro Bowl", "Hall of Fame", "Super Bowl", "Combine", "Senior Bowl", etc.)
2. Player-name detection regex tightened from "any capitalized token" to FirstName-LastName pattern: `\b[A-Z][a-z]+ [A-Z][a-z]+(-[A-Z][a-z]+)?\b`. Single capitalized words ("Buffalo", "Bills") never trigger player-unknown.
3. Approve-anyway override now logs the rejected token + override reason. If we keep flagging the same token, that's data telling us to add it to the allowlist.
4. Regression tests: paragraph mentioning all 32 teams + 5 stadiums + 3 conferences passes; fabricated player ("Jorge Velasquez") fails; real player from roster passes.
5. L0-07 acceptance updated.

---

## WARNING #3 — Postgres ↔ Filesystem dual-write isn't atomic

**Codex location:** §3.8 Draft persistence

**Finding:** "The doc claims DB + file writes happen in 'a single transaction-like flow,' but Postgres transactions can't roll back filesystem writes. If the file write fails (e.g., storage outage) after the DB commit, state drifts and the sync checker has to heal it later."

**Recommendation:** "Once durability moves off local disk (see critical #1), wrap both writes in application-level idempotent logic: write to the durable blob first, then commit DB with blob pointer; retries resume cleanly without drift. Document the sequence and add failure tests."

**Adjudication:** Accepted. Dissolves automatically with CRITICAL #1's DB-only persistence — there's no second store to coordinate with. Postgres `UPDATE` is naturally atomic.

**Plan changes:** captured implicitly in §3.8 rewrite. No separate dual-write logic exists in v2.

---

## WARNING #4 — Beehiiv "Publish" status misleads

**Codex location:** §3.11 Beehiiv publish

**Finding:** "The Beehiiv API call is sent with `status='draft'`, yet the studio flips `status='published'` immediately. Operators will see 'published' even though the email still needs manual review/send in Beehiiv, obscuring the true workflow state."

**Recommendation:** "Introduce an intermediate 'exported'/'queued' state until Beehiiv confirms actual publish (or operator flags completion). Update UI copy and task L0-19/L0-20 acceptance criteria accordingly."

**Adjudication:** Accepted. Good UX catch — distinguishing "we sent the bytes to Beehiiv" from "the email actually went out" matters for operator confidence.

**Plan changes:**

1. §3.11 rewritten with explicit state machine:
   ```
   draft → approved → exported → published
                        ↓
                    cancel-export → approved
   ```
2. New `exported` state inserted between `approved` and `published`. State means: "sent to Beehiiv as a draft post; awaiting operator confirmation that the email was actually sent."
3. `setAsPublished` Server Action / CLI: requires state=exported. Captures published_url + published_at. Locks read-only.
4. `cancelExport` Server Action: reverts exported→approved if operator needs to make further edits.
5. Editor UI footer state indicator added. Operator never sees a "published" indicator until they explicitly confirm.
6. L0-19 + L0-20 acceptance updated.

---

## PRAISE — Task breakdown structure

**Codex location:** §8 (and SPEC.md §3.5a, which lives outside this plan)

**What's working (per codex):** "Preserve the deterministic rank/tiebreak rules and the contract-test focus; they materially reduce the main data risk."

**Adjudication:** Note: the §3.5a reference is to the project's SPEC.md, not this plan — design-review bundles all design artifacts, so SPEC.md was reviewed alongside. The praise applies to the integrity rules in SPEC.md and the test matrix in this plan's §8. Both preserved.

---

## What codex did NOT raise (and probably should have)

For the record, things I worried about in v1's "Anticipated lines of attack" that codex didn't surface:

- **LLM cost optimism** — codex didn't push back on the $0.50/piece target. Real cost depends on input size + cache hit rate; if cache misses are common (which the cron's 30min interval relative to Anthropic's 5min cache TTL suggests they'll be), cost could be 2–3× higher. Risk register §9 already flags this; L1-02 (Sonnet vs Haiku eval) is the validation step.
- **Per-section regenerate markdown-merge fragility** — also not flagged. The current spec relies on exact heading-text match; if AI rephrases a heading in regeneration, the merge breaks. v1 mitigation (fail loudly on missing heading) is preserved; L1-05 (per-section regenerate UX hardening) is the tightening pass.
- **Voice exemplar generalization** — not raised. Currently 1 exemplar (opponent preview). L1-03 plans collection of 2–4 more before paid flip.

These remain in the risk register with task-level mitigations. Not promoted to v2 changes since codex didn't flag them as plan-blocking.

---

## Verdict + sign-off

- **Codex verdict:** Needs revisions before implementation. Confidence: medium.
- **Critical findings adjudicated:** 2 of 2
- **Warnings adjudicated:** 4 of 4
- **Praise preserved:** 1 of 1

Plan is now **v2**, ready for task creation.
