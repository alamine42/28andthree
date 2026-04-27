# E10b (lnv): AI Authoring Studio — Technical Plan

**Status:** v2 (post-codex adversarial review — 2 CRITICALs + 4 WARNINGs + 1 PRAISE)
**Beads issue:** `patsbythenumbers-lnv`
**Companion epic:** `patsbythenumbers-cp4` (E10 Membership — the surface this powers)
**Sprint:** offseason 2026 (May–Aug build, dogfood Sept, paid pieces from Oct)
**Review doc:** `e10b-ai-authoring-plan-adversarial-review.md`

> **v2 delta vs v1**:
> - **CRITICAL #1 (codex):** Vercel's serverless runtime has no persistent filesystem. v1 baked in a DB+filesystem dual-storage pattern lifted from notaligned (which runs on a long-lived host). Drafts now live in a `markdown_content text` column in Postgres only. The "git-versioned archive" reframed: a separate `pnpm authoring:export` CLI runs locally to write published drafts to `drafts/` for git-commit. §3.8 rewritten.
> - **CRITICAL #2 (codex):** Cron can't authenticate via cookie. Middleware now accepts EITHER cookie (browser/operator) OR `Authorization: Bearer <AUTHORING_CRON_TOKEN>` (service-to-service). GH Actions sends the token. §3.3 + §3.9 rewritten.
> - **WARNING #1 (codex):** Voice editor "Save and commit" is impossible on Vercel. v2: voice editor is **read-only in v1**. Editing prompt files requires local CLI workflow. Future epic can add edit-via-DB-and-publish-flow if needed. §2.6 + L0-15 rewritten.
> - **WARNING #2 (codex):** Factcheck proper-noun gate would flag "Bills", "Buffalo", "AFC". v2: factcheck uses an explicit allowlist (existing `lib/constants/teams.ts` for all 32 teams + cities + abbreviations, plus a curated football-common-nouns list). Player-name detection only triggers on FirstName-LastName patterns not in the player roster. §3.7 rewritten.
> - **WARNING #3 (codex):** "Atomic" DB+filesystem write isn't actually atomic. Resolved by dropping the filesystem mirror entirely (CRITICAL #1).
> - **WARNING #4 (codex):** Beehiiv state misleads — we sent status='draft' to Beehiiv but flipped our local state to 'published'. v2: new `exported` state inserted between `approved` and `published`. Operator sets to `published` only after manual confirmation on Beehiiv. §3.11 rewritten + state machine diagram added.
> - PRAISE preserved: §8 task breakdown structure kept.

---

## 1. Context

### Problem

E10 Membership commits to a paid Wednesday opponent preview at format-and-depth that's tractable only with AI authoring. That promise has three concrete preconditions:

1. A **pipeline** that takes structured Patriots data → an LLM → a fact-checked, voice-consistent draft, on demand or on schedule.
2. A **studio** where a single operator can review, edit, schedule, publish, and curate voice/format guidelines without leaving the browser.
3. A **backlog + schedule** that turns "topic ideas" into "scheduled drafts" and prevents the operator from forgetting what's coming up.

Without these three, E10 either ships at unsustainable human-author cost (defeats the point) or ships AI prose nobody wants to read (defeats the paid tier). E10b is what makes E10 ship.

### Audience

A solo operator: you. Single-device, single-session typical use. The studio's design constraint is "fast for one person", not "scalable for a team." The pipeline's design constraint is "produces output that clears the Phase 2.5 quality gate in cp4", not "supports arbitrary content types out of the box."

### Why now

- E10 cp4 plan's Phase 2 (free Sunday recap shipping at season opener) needs a pipeline operational by ~mid-August 2026 — ~16 weeks from today.
- Paid Wednesday preview shipping by Oct/Nov 2026 needs the studio operational by Sept (allowing a 4-week dogfood window before paid flip).
- Reference architecture (`~/Development/notaligned`) exists and is well-understood; building from a known pattern reduces risk.

### Success (qualitative)

- Generating a draft is **one click** in the studio (or one CLI command, or one cron tick — same code path).
- The operator never edits a prompt file in their text editor unless they want to: the studio voice editor handles ~95% of voice/format curation in-browser.
- Hallucinations on numbers + player names are caught before any human sees them.
- A bad week (LLM API down, Patriots schedule slip, dependency outage) fails *loudly*: operator gets a Sentry alert before the publish window, not a missed send.
- Cost stays under target (<$0.50/piece average) without active management.

### Success (quantitative acceptance)

Mirrored in §8 task acceptance + lnv acceptance criteria 1–21:

1. CLI `pnpm authoring:generate recap <game_id>` produces a 6-section Sunday recap.
2. CLI `pnpm authoring:generate preview <opponent> <week>` produces a 4-section Wednesday opponent preview.
3. Drafts persist as DB row + markdown file; both stay in sync.
4. Hallucination guard catches a fabricated stat in a regression test.
5. Anthropic prompt-cache hit rate >80% across a 10-piece sample.
6. Voice consistency verified: 3 sample pieces judged "this sounds like 28 and Three" by user.
7. LLM cost per piece <$0.50 average; alert if 7-day rolling exceeds threshold.
8. Studio routes (`/admin`, `/admin/drafts`, `/admin/drafts/[id]`, `/admin/backlog`, `/admin/voice`, `/admin/schedule`, `/admin/telemetry`) deploy and are auth-gated by env-key.
9. Cron-triggered generation works end-to-end: GH Actions cron → `/api/authoring/generate` → draft surfaces in studio.
10. Beehiiv publish: API path verified + manual fallback verified end-to-end.

---

## 2. UX

The studio is the operator-facing surface. Six routes under `/admin`. Layout uses DESIGN.md tokens — the studio looks like the public site, not a Bootstrap dashboard. Density-forward, mono-numerics, hairline borders.

### 2.1 Studio shell layout

```
┌─────────────────────────────────────────────────────────────┐
│ 28 AND THREE / STUDIO                       [logout]        │ ← thin top bar
├─────┬───────────────────────────────────────────────────────┤
│     │                                                       │
│ NAV │  CONTENT                                              │
│     │                                                       │
│ ▸ Dashboard                                                 │
│ ▸ Drafts                                                    │
│ ▸ Backlog                                                   │
│ ▸ Schedule                                                  │
│ ▸ Voice                                                     │
│ ▸ Telemetry                                                 │
│     │                                                       │
└─────┴───────────────────────────────────────────────────────┘
```

Sidebar collapses to icons-only on narrow screens. Top bar is thin (h-12); logout button is a discreet ghost link. No breadcrumbs (trees are shallow); current-route indicated by a left-border highlight in the sidebar.

### 2.2 Dashboard `/admin`

The "what's happening right now" view. Four panels above the fold:

```
┌─────────────────────┐ ┌─────────────────────┐
│ UPCOMING            │ │ DRAFTS IN REVIEW    │
│ ─────────           │ │ ─────────           │
│ Tue 6:00 — preview  │ │ 2025-w08-bills      │
│ Sat 6:00 — recap    │ │ 2025-w07-titans     │
│ [Generate now]      │ │                     │
└─────────────────────┘ └─────────────────────┘

┌─────────────────────┐ ┌─────────────────────┐
│ RECENT FAILURES (7d)│ │ COST (7d)           │
│ ─────────           │ │ ─────────           │
│ none                │ │ $1.83 / 4 pieces    │
│                     │ │ avg $0.46 (target $0.50) │
└─────────────────────┘ └─────────────────────┘
```

Each panel is a Server Component with no client JS. "Generate now" opens a modal-less inline form for picking a content type + context key. No charts, no animation.

### 2.3 Drafts list `/admin/drafts`

Table view, mono-typography, dense. Columns: status / type / slug / generated_at / cost / publish status. Click a row → `/admin/drafts/[id]`. Filterable by status (URL param: `?status=draft|approved|published|rejected`). Row hover fills background with `--surface` per DESIGN.md.

### 2.4 Draft editor `/admin/drafts/[id]` ★

The most-used screen. Two-pane:

```
┌─────────────────────────────────┬─────────────────────────────┐
│ MARKDOWN EDITOR                 │ SOURCE DATA                 │
│                                 │                             │
│ ## Pass-O vs Pass-D — Wk 8...   │ NE pass-O EPA/dropback:     │
│                                 │   −0.12 (24th)              │
│ ### Setup                       │ BUF pass-D allowed:         │
│ The numbers say this is...      │   −0.08 (8th)               │
│                                 │ Maye blitz EPA: −0.31       │
│ <textarea>                      │ Douglas slot rate (3w):     │
│                                 │   71% (was 48% Wk 1–4)      │
│                                 │ NE play-action EPA: +0.18   │
│                                 │   (12th)                    │
│                                 │ ...                         │
│                                 │                             │
│ [Save] (auto-saves on blur)     │ [Open dashboard for season] │
│                                 │                             │
├─────────────────────────────────┴─────────────────────────────┤
│ FACTCHECK: ✓ all numerics match source                        │
│                                                               │
│ [Regenerate section ▾] [Approve] [Reject] [Export to Beehiiv] │
└───────────────────────────────────────────────────────────────┘
```

- **Markdown editor**: textarea with monospace font, no client-side rich-text widget. Server Action saves on blur (debounced 500ms via client wrapper). Save status indicator: "saved 4s ago" / "saving..." / "save failed — retry".
- **Source data pane**: read-only render of the structured input that was fed to the prompt. Numerics in mono. Any number the LLM wrote in markdown that is also in the source pane is highlighted on hover (visual cross-check).
- **Factcheck status bar**: green if all numerics + names cross-check; red with the failing tokens listed if not. Editor allows save even when factcheck fails — but Approve button is disabled until factcheck passes (or operator overrides via "approve anyway" with a required reason).
- **Regenerate section**: dropdown lists each `## Heading` in the markdown; clicking one re-runs the LLM only for that section, keeping the rest. Useful when one section reads weird but the others are fine.
- **Approve / Reject / Export**: Approve marks `status='approved'` and unlocks publish. Reject moves to `status='rejected'` with required reason. Export-to-Beehiiv opens a side panel with HTML preview + clipboard copy + deep-link to Beehiiv composer.
- **Read-only mode**: when `status='published'`, the editor renders read-only — no save, no regenerate. Header shows "PUBLISHED <date> — <published_url>" with a link.

### 2.5 Backlog `/admin/backlog`

Topic queue. Table with: title / type / priority / status / used_in_draft / actions. Add-new form at top (title + notes + content_type + priority). Filters: status (pending|scheduled|used|archived), priority. Bulk action: "schedule selected" → opens a slot picker.

State transitions visible in the table: pending rows are open, scheduled have a clock glyph + slot, used are dimmed with a link to the draft they ended up in, archived are hidden by default (toggle to show).

### 2.6 Voice editor `/admin/voice` *(read-only in v1)*

**v2 (post-codex):** the original "edit + save-and-commit-from-browser" design is impossible on Vercel — no persistent filesystem, no git binary, no push credentials. v1 ships a **read-only** voice editor; editing prompt files happens via the local CLI workflow.

What the studio shows:
- List of all `prompts/*.md` files + `AUTHORING.md` + format-spec docs
- Click → renders the file (markdown rendered, with raw-source toggle)
- Footer note: **"To edit: clone the repo, edit the file in your text editor, commit + push. Vercel rebuilds and the studio reads the new content."**

Why this is actually fine for v1:
- Prompt-file edits are infrequent (every few weeks at most, not every draft)
- Local CLI editing is the natural flow for content infra changes (alongside reading + iterating on actual AI output)
- Avoids inventing a publish-via-DB-and-rebuild workflow before we know we need it

**v2 future work (not v1):** if voice-editing-from-browser becomes high-friction after dogfood phase, file a follow-up epic that stores prompts in a Vercel Blob / R2 / Postgres bytea column with explicit publish flow. Don't pre-build it.

The voice analyzer (Phase 2) still appears here as a sidebar panel, feature-flagged. When enabled, it surfaces suggested pattern additions but does not auto-apply them — operator copies into local prompt file edits.

### 2.7 Schedule `/admin/schedule`

Calendar-ish list view (not a grid — that's overkill for ~2 events/week). Lists upcoming auto-scheduled runs from E9's ScheduleSnapshot. Each row: when / type / context_key (e.g. opponent code) / status (queued|completed|skipped). Past 14 days visible above next 14 days, separated by a thin line.

Operator actions:
- **Generate now** — bypass cron, fire immediately
- **Skip this slot** — mark status='skipped' (offseason or bye-week handling)
- **Move backlog item to slot** — pick a backlog topic, schedule it into a future slot (overrides default content_type for that slot)

### 2.8 Telemetry `/admin/telemetry`

Three charts (Recharts, same as the public site). Each is a sparkline-density visualization, not a dashboard chart:

- **Cost trend**: per-piece cost stacked over 30 days
- **Cache hit rate**: 30-day rolling average
- **Factcheck rejection rate**: % of generated drafts that failed factcheck, 30-day window

Below charts: a paginated `authoring_runs` log table — every LLM call, sortable by cost. Useful for "what was the most expensive draft this month?" debugging.

### 2.9 Login `/admin/login`

Single text input (password) + submit. Sets `28t_admin_session` cookie. Redirects to `/admin`. Wrong password: rate-limited (5 attempts / 15 min / IP), generic error ("invalid"). No password recovery — this is single-operator with the password in your password manager.

### 2.10 Anti-goals (UX)

- **No multi-author UI.** No comments, no review threads, no "@-mention" anything.
- **No drag-and-drop anywhere.** Moves backlog items to slots via a select picker.
- **No notification system in-product.** Sentry handles alerts.
- **No internationalization** — single operator, single language.
- **No light mode.** Studio inherits dark-first stance.
- **No real-time collaboration.** Single-session is the model; concurrent edits are guarded by per-resource locks (DB advisory) but the UI doesn't surface other "users".

---

## 3. Technical architecture

### 3.1 Stack overview

- **Next.js 15 App Router** for studio + API routes — same stack as the public site
- **Drizzle ORM** for new authoring tables in the same Neon Postgres
- **Anthropic SDK** (Claude) with prompt caching
- **GitHub Actions cron** for scheduled generation (consistent with existing ETL workflow)
- **Markdown** as the canonical draft format; markdown→HTML for Beehiiv export via `marked`
- **Filesystem mirror** in `drafts/` for human-readable archive (git-versioned)
- **No new infra services** — no Redis, no queue, no external storage. Everything runs on existing Vercel + Neon + GitHub Actions.

### 3.2 Drizzle schema (4 new tables)

Migration `00XX_authoring_studio.sql` (next number after current head).

```typescript
// db/schema.ts additions
export const authoringDrafts = pgTable('authoring_drafts', {
  id: text('id').primaryKey(),                       // slug: "2026-w08-bills-opponent-preview"
  contentType: text('content_type').notNull(),       // 'recap' | 'opponent_preview' | 'deep_dive_*'
  title: text('title'),
  slug: text('slug').notNull().unique(),
  filepath: text('filepath').notNull(),              // relative to repo root
  contentHash: text('content_hash'),                 // sha256 of current markdown
  status: text('status').notNull().default('draft'), // draft|approved|published|rejected|archived
  beehiivPostId: text('beehiiv_post_id'),
  beehiivPostUrl: text('beehiiv_post_url'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  factcheckStatus: text('factcheck_status').notNull().default('pending'), // pass|fail|pending
  factcheckFindings: jsonb('factcheck_findings'),
  sourceDataHash: text('source_data_hash'),
  costUsd: doublePrecision('cost_usd'),
  metadata: jsonb('metadata'),
}, (t) => ({
  statusIdx: index('idx_authoring_drafts_status').on(t.status),
  typeGenIdx: index('idx_authoring_drafts_type_generated').on(t.contentType, t.generatedAt),
}));

export const authoringBacklog = pgTable('authoring_backlog', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  notes: text('notes'),
  contentType: text('content_type'),
  priority: smallint('priority').notNull().default(2),
  source: text('source').notNull(),                  // manual|suggested_from_event|imported
  status: text('status').notNull().default('pending'), // pending|scheduled|used|archived
  usedInDraftId: text('used_in_draft_id').references(() => authoringDrafts.id),
  scheduledForSlot: text('scheduled_for_slot'),      // FK-like to authoringSchedules.id
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index('idx_authoring_backlog_status').on(t.status),
  priorityIdx: index('idx_authoring_backlog_priority').on(t.priority),
}));

export const authoringSchedules = pgTable('authoring_schedules', {
  id: text('id').primaryKey(),                       // "2026-w08-opponent-preview"
  contentType: text('content_type').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  contextKey: text('context_key'),                   // game_id or opponent code
  draftId: text('draft_id').references(() => authoringDrafts.id),
  status: text('status').notNull().default('queued'), // queued|running|completed|failed|skipped
  attemptedAt: timestamp('attempted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  errorText: text('error_text'),
  attempts: smallint('attempts').notNull().default(0),
  metadata: jsonb('metadata'),
}, (t) => ({
  schedStatusIdx: index('idx_authoring_schedules_sched_status').on(t.scheduledAt, t.status),
}));

export const authoringRuns = pgTable('authoring_runs', {
  id: serial('id').primaryKey(),
  draftId: text('draft_id').references(() => authoringDrafts.id),
  contentType: text('content_type').notNull(),
  trigger: text('trigger').notNull(),                // cli|cron|studio_button|regenerate_section
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cacheReadTokens: integer('cache_read_tokens'),
  cacheWriteTokens: integer('cache_write_tokens'),
  costUsd: doublePrecision('cost_usd'),
  promptCacheHit: boolean('prompt_cache_hit'),
  factcheckStatus: text('factcheck_status'),
  durationMs: integer('duration_ms'),
  errorText: text('error_text'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  createdIdx: index('idx_authoring_runs_created').on(t.createdAt),
  typeCreatedIdx: index('idx_authoring_runs_type_created').on(t.contentType, t.createdAt),
}));
```

CHECK constraints: `status` and `factcheck_status` and `priority`/`source`/`trigger` enums enforced at the DB layer (consistent with existing project pattern).

### 3.3 Auth — dual path: cookie (operator) + bearer token (cron)

**v2 (post-codex CRITICAL #2):** original v1 only accepted cookie auth, so GitHub Actions cron couldn't reach `/api/authoring/generate`. Middleware now accepts EITHER credential type, with bearer token reserved for service-to-service.

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdminUI = path.startsWith('/admin') && path !== '/admin/login';
  const isAuthoringApi = path.startsWith('/api/authoring');
  if (!isAdminUI && !isAuthoringApi) return NextResponse.next();

  // Path 1: bearer token (cron, CLI from CI)
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7);
    const expected = process.env.AUTHORING_CRON_TOKEN;
    if (expected && timingSafeEqual(token, expected)) {
      return NextResponse.next();
    }
    // bad bearer: fall through to cookie check (don't reveal token validity)
  }

  // Path 2: cookie (operator browser session)
  const cookie = req.cookies.get('28t_admin_session')?.value;
  const expectedSession = process.env.ADMIN_SESSION_KEY;
  if (!expectedSession) return NextResponse.json({ error: 'admin disabled' }, { status: 503 });
  if (cookie && timingSafeEqual(cookie, expectedSession)) {
    return NextResponse.next();
  }

  // Fail
  if (isAdminUI) return NextResponse.redirect(new URL('/admin/login', req.url));
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
```

Three secrets in Vercel env:
- `ADMIN_PASSWORD` — what the operator types at `/admin/login`
- `ADMIN_SESSION_KEY` — 32-byte random hex set as cookie value on successful login
- `AUTHORING_CRON_TOKEN` — 32-byte random hex used by GH Actions in `Authorization: Bearer <token>`

Cookie security: HttpOnly + Secure + SameSite=Strict. Cookie rotation = rotate `ADMIN_SESSION_KEY` (logs operator out — fine for single-operator).

Bearer token security: stored as GitHub Actions secret, never logged, not visible in workflow output. Rotation = rotate `AUTHORING_CRON_TOKEN` + update GH secret. Independent rotation cadence from cookie.

Why fall-through (bad bearer → try cookie) instead of fail-fast: an operator who copy-pastes a curl with a stale bearer accidentally still gets a useful redirect. Doesn't reveal whether bearer was invalid vs missing.

CSRF on Server Actions: Next.js 15 enables Origin checking by default; nothing additional needed.

### 3.4 Prompt + voice exemplar files

`prompts/` directory at repo root, version-controlled:

```
prompts/
  system.md                  # shared system prompt for ALL content types
  voice-exemplars.md         # 3-5 user-marked voice samples (currently 1: lnv exemplar #1)
  format-recap.md            # Sunday recap section template + length budgets
  format-opponent-preview.md # 4-section preview template (Setup/Signal/Counterpoint/WTW)
  format-deep-dive.md        # offseason long-form template
```

`AUTHORING.md` lives at repo root (sibling of CLAUDE.md, DESIGN.md). It is the long-form voice + content guideline document; loaded into the system prompt verbatim.

### 3.5 DAL extractors per content type

`lib/authoring/extractors/`:

```typescript
// lib/authoring/extractors/types.ts
export type ExtractorContext<T> = {
  contentType: ContentType;
  contextKey: string;
  data: T;             // structured, JSON-serializable
  numericClaims: NumericClaim[];  // pre-extracted for factcheck reference
  playerNames: string[];          // pre-extracted for factcheck reference
  generatedAt: Date;
};

// lib/authoring/extractors/opponent-preview.ts
export async function extractOpponentPreviewContext(
  opponent: TeamCode,
  week: number,
  season: number,
): Promise<ExtractorContext<OpponentPreviewData>> {
  // Read from existing DAL: lib/data/team.ts, lib/data/contributors.ts, etc.
  // Shape into OpponentPreviewData (typed structured object).
  // Pre-extract numerics + player names so factcheck has a reference.
  // Return.
}
```

Each extractor is pure: same inputs → same outputs. No side effects, no LLM calls, no file IO. Critical for testing — each extractor gets a unit test using fixture data.

The numericClaims/playerNames extraction is what the factcheck guard uses as ground truth. If a number isn't in this array, the LLM made it up.

### 3.6 LLM call architecture + prompt caching

`lib/authoring/generate.ts` — the canonical entrypoint:

```typescript
export async function generateDraft(params: {
  contentType: ContentType;
  contextKey: string;
  trigger: Trigger;
  regenerateSection?: string;  // optional: regenerate just one section of an existing draft
}): Promise<DraftResult> {
  // 1. Acquire advisory lock (Postgres pg_try_advisory_lock keyed on draft slug)
  // 2. Resolve draft slug; check for existing draft
  // 3. Run extractor for contentType → ExtractorContext
  // 4. Build prompt:
  //    - System block (cacheable):
  //      * Persona text (loaded from prompts/system.md)
  //      * Voice exemplars (prompts/voice-exemplars.md)
  //      * Format spec (prompts/format-<content_type>.md)
  //      * AUTHORING.md content
  //      cache_control: { type: 'ephemeral' } at end of system block
  //    - User block (variable, NOT cached):
  //      * JSON-formatted ExtractorContext.data
  //      * Optional: regenerate-section instruction
  // 5. Call Anthropic SDK; capture response + usage metadata
  // 6. Parse response (markdown extraction)
  // 7. Run hallucination guard (factcheck.ts) against ExtractorContext.numericClaims/playerNames
  // 8. Persist to DB + filesystem
  // 9. Log telemetry to authoring_runs
  // 10. Release lock; return result
}
```

Cache breakpoint placement: the system block ends with `{ type: 'ephemeral' }` cache_control. Anthropic prompt cache TTL is 5min by default; we keep cache warm by issuing CLI heartbeat calls during dev. In prod, the cron schedule (Tue 6 AM, Sat 6 PM) is far apart — cache won't carry over between scheduled runs, but each run benefits from the cache during its own retry path (initial draft → factcheck fail → regenerate section).

Model selection:
- **Default: Claude Sonnet 4.6.** Best quality/cost balance.
- **Fallback (tested in P1-eval): Haiku 4.5.** Cheaper first-draft generation; promote if quality clears the gate.
- Selected per-call via `AUTHORING_MODEL` env (default `sonnet`).

Cost calculation in `lib/authoring/cost.ts`: per-token rates for Sonnet/Haiku, separate prices for cache-read vs cache-write vs non-cached input. Persisted in `authoring_runs.cost_usd`.

### 3.7 Hallucination guard

**v2 (post-codex WARNING #2):** original v1 flagged any capitalized token not in `playerNames` as `player_unknown`. That would have flagged "Bills", "Buffalo", "AFC", "Wk", "Patriots" — every paragraph. Refactored to use explicit allowlists + a stricter player-name detection regex.

`lib/authoring/factcheck.ts`:

```typescript
export type FactcheckFinding = {
  type: 'numeric_drift' | 'player_unknown';
  token: string;
  context: string;     // surrounding text snippet
  expected?: string | number;
};

export function factcheck(
  markdown: string,
  ctx: ExtractorContext<unknown>,
): { status: 'pass' | 'fail'; findings: FactcheckFinding[] } {
  // PASS 1: numeric drift
  // - Regex: /(?<![A-Za-z0-9._])-?\d+(?:\.\d+)?%?/g
  // - Real minus sign U+2212 normalized to ASCII − before matching
  // - For each numeric: find a match in ctx.numericClaims with rounding tolerance ±0.005
  //   No match → finding type=numeric_drift

  // PASS 2: unknown player names
  // - Regex match: /\b[A-Z][a-z]+ [A-Z][a-z]+(-[A-Z][a-z]+)?\b/g
  //   (FirstName LastName, optionally LastName-LastName2)
  //   This deliberately misses single-word names — most football names are 2-word, and
  //   the false-negative cost (DK on draft scouting) is lower than the false-positive
  //   cost of flagging "Buffalo" as a player.
  // - Skip the match if it is in any of:
  //   * ctx.playerNames (the roster context the extractor passed in)
  //   * ALLOWLIST_TEAMS (32 teams + cities + abbreviations from lib/constants/teams.ts)
  //   * ALLOWLIST_COACHES (curated list of head coaches + coordinators, NE-relevant)
  //   * ALLOWLIST_STADIUMS (NFL stadium names + cities)
  //   * ALLOWLIST_FOOTBALL_NOUNS (positions, divisions, conferences, special phrases like
  //     "Pro Bowl", "Hall of Fame", "Super Bowl", "MVP", "ROY")
  // - Match remaining → finding type=player_unknown (likely fabricated)
}
```

Allowlists live in `lib/authoring/factcheck-allowlist.ts`:
- Teams: synthesized from `lib/constants/teams.ts` (already source of truth for all 32 NFL teams + abbrs + cities + nicknames).
- Coaches: hand-curated, ~50 entries (HCs + OCs/DCs of relevant teams). Refreshed annually before season.
- Stadiums: hand-curated. Static enough that updating a list once a season is fine.
- Football common nouns: hand-curated, ~100 entries. Includes things like "Wild Card", "Combine", "Senior Bowl", "Pro Day", "Sack", "Touchdown", positions ("Quarterback", "Running Back", etc.).

Regression tests for the allowlists:
- Sample paragraph mentioning all 32 teams + 5 stadiums + 3 conferences passes
- Sample paragraph with a fabricated player name "Jorge Velasquez" fails with `player_unknown`
- Sample paragraph with "Drake Maye" (in `ctx.playerNames` from roster) passes
- Sample paragraph with current Patriots HC last name in coaches allowlist passes

**Tolerance for numerics:** 0.005 rounding tolerance handles "EPA −0.12" matching source "EPA −0.123" (display rounding). Stricter would generate false positives; looser would let drifts slip.

**False-positive escape hatch:** editor has "approve anyway" button that requires a typed reason. Counts toward a metric — if approve-anyways exceed 10% of approvals, the factcheck heuristic needs tuning. Specifically: when a finding is overridden, the override reason is logged with the token, so we can spot patterns ("we keep flagging X — it should go in the allowlist").

Future v2 — claim verification (superlatives that don't tie to a number) deferred. Not in v1 scope.

### 3.8 Draft persistence — DB only

**v2 (post-codex CRITICAL #1):** original v1 design wrote drafts to both DB and `drafts/<content_type>/<slug>.md` filesystem mirror. That pattern works on long-lived hosts (notaligned runs on a static box). On Vercel's serverless runtime: filesystem outside `/tmp` is read-only; `/tmp` is ephemeral per-invocation. Filesystem mirror is impossible. Drafts now live exclusively in Postgres.

Schema change from v1: `authoring_drafts` gains a `markdown_content text` column. `filepath` and `contentHash` columns dropped (contentHash semantics fold into `markdown_content` itself + an optional sha256 column for cache keying).

```typescript
// db/schema.ts — authoring_drafts (revised)
export const authoringDrafts = pgTable('authoring_drafts', {
  id: text('id').primaryKey(),
  contentType: text('content_type').notNull(),
  title: text('title'),
  slug: text('slug').notNull().unique(),
  markdownContent: text('markdown_content').notNull(),  // v2: was filepath
  contentSha256: text('content_sha256'),                // optional cache key
  status: text('status').notNull().default('draft'),
  // ... rest unchanged
});
```

Saves are atomic Postgres `UPDATE`s. No dual-write, no consistency reconciliation. WARNING #3 dissolved.

#### Git-versioned archive (separate, optional, post-publish)

The "git history of drafts" goal from v1 is preserved as a **separate, local-only CLI workflow**, not as a runtime feature:

```bash
pnpm authoring:export    # local; pulls all status='published' drafts from prod DB
                         # writes them to drafts/<content_type>/<slug>.md
                         # operator commits + pushes the archive periodically
```

This runs from the operator's local machine, not from Vercel. It uses the existing prod DB connection (read-only, like sandbox-dump.ts). Archive is a periodic snapshot (operator triggers, weekly is fine), not a real-time mirror.

Why this trade is OK:
- Live, queryable state lives in Postgres (where studio reads it from)
- Git history of finished work lives in `drafts/` (only as a snapshot the operator chooses to commit)
- Recovery path: if Postgres state is lost, restore from the most recent archive commit + regenerate any missing pieces from the LLM

Sample of the export script lives at `scripts/authoring-export.ts` (modeled on `scripts/sandbox-dump.ts`).

Filesystem reads from the running app: `prompts/*.md` and `AUTHORING.md` are committed to the repo and shipped with the deployment. They're readable at runtime (Vercel ships repo files into the function bundle). They're NOT writable. Voice editor in studio reads them; editing happens locally (§2.6).

### 3.9 Multi-trigger orchestration

Three entrypoints, one code path (`generateDraft()`):

- **CLI:** `scripts/authoring-generate.ts` (`pnpm authoring:generate <type> <key>`). Calls `generateDraft({ trigger: 'cli', ... })` directly. Local execution; uses `DATABASE_URL` env. No HTTP, no auth.
- **Cron:** GitHub Actions workflow `.github/workflows/authoring-cron.yml` runs every 30min. Queries `authoring_schedules` for runs where `scheduled_at <= now() AND status = 'queued'`. For each, POSTs to `/api/authoring/generate` with the schedule id, sending **`Authorization: Bearer <AUTHORING_CRON_TOKEN>`** (post-codex CRITICAL #2). Route handler calls `generateDraft({ trigger: 'cron', ... })`.
- **Studio button:** Server Action on `/admin` "Generate now" form calls `generateDraft({ trigger: 'studio_button', ... })`. Cookie auth (operator session).

The bearer-token path is the cron-specific solution to the auth gap — middleware (§3.3) accepts EITHER bearer or cookie. Cron has the bearer; operator browser has the cookie. Same destination route, two credential types.

GH Actions runs every 30min instead of pinning to specific times because:
- Avoids drift on DST boundaries
- Lets us populate `authoring_schedules` flexibly without editing the YAML
- Costs ~30 min/day of Actions budget = ~900 min/mo (well under 2000/mo free tier)

Cron heartbeat: `webhook.heartbeat` event written to `authoring_runs` with no draft. If 4+ consecutive 30-min ticks miss the heartbeat, Sentry alert.

Workflow file sketch:

```yaml
# .github/workflows/authoring-cron.yml
on:
  schedule: [{ cron: '*/30 * * * *' }]   # every 30min UTC
  workflow_dispatch:
jobs:
  authoring-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger authoring generate
        run: |
          curl -fsS -X POST https://28andthree.com/api/authoring/cron-tick \
            -H "Authorization: Bearer ${{ secrets.AUTHORING_CRON_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"source":"github_actions"}'
```

Route `/api/authoring/cron-tick` (separate from `/api/authoring/generate`): owns the loop logic — query authoring_schedules, kick off generations one at a time, write heartbeat. `/generate` is the per-piece endpoint; `/cron-tick` is the per-tick orchestrator. Keeps each route focused.

### 3.10 Editor + Server Actions

The editor uses Next.js 15 Server Actions, not API routes, for save/regenerate/approve/reject. Reasons:
- Idiomatic for the form-driven workflow
- Built-in CSRF (Origin check)
- Closer integration with `revalidatePath` for partial cache invalidation

API routes used only when an external system needs to call us (cron via GH Actions, Beehiiv webhook in cp4). Internal browser → server traffic uses Server Actions.

Live save implementation: client component wraps the textarea, debounces (500ms), calls Server Action. Status indicator updates. Conflict detection via `contentHash` — if the server's hash differs from the client's last-known, the save fails with a 409 "concurrent edit" message. Single-operator means this should never trigger; if it does, we want to know.

### 3.11 Beehiiv publish + state machine

**v2 (post-codex WARNING #4):** original design called Beehiiv API with `status='draft'` (their side) and immediately flipped our state to `'published'`. That was misleading — the email still needed manual review + send in Beehiiv. New state machine inserts an `exported` state.

#### State machine

```
   draft  ──approve──▶  approved  ──export──▶  exported  ──set-as-published──▶  published
     │                       │                     │                                  │
     └─reject──▶ rejected  ◀─┘                     │                                  │
                                                   └─cancel-export──▶ approved        │
                                                                                      │
              archived ◀────── (from any state, manual operator action)               │
              ────────────────────────────────────────────────────────────────────────┘
```

- `draft` → fresh from generation; factcheck may be pending or failed
- `approved` → operator clicked Approve; factcheck passed (or override applied with reason)
- `exported` → sent to Beehiiv (API or manual paste); awaiting actual send + operator confirmation
- `published` → operator confirmed in Beehiiv that the email was sent; locks read-only
- `rejected` → operator decided not to ship; reason recorded
- `archived` → no longer relevant; soft-delete from default views

Editor is **editable** in `draft` and `approved` states; **read-only** in `exported`, `published`, `rejected`, `archived`. The `exported` lock is intentional — once you've handed it to Beehiiv, edit it there or move it back via `cancel-export` if you need a major rewrite.

#### Implementation

`lib/authoring/publish-beehiiv.ts`:

```typescript
export async function exportToBeehiiv(draftId: string, mode: 'api' | 'manual'): Promise<ExportResult> {
  // 1. Read draft; verify status='approved'
  // 2. Convert markdown → Beehiiv-safe HTML via marked + custom renderer:
  //    - h1 → ignored (Beehiiv has title field)
  //    - h2 → <h2 style="..."> with inline DESIGN.md tokens
  //    - h3 → <h3 style="...">
  //    - links → preserve, add ?utm_source=newsletter
  //    - dashboard-link convention preserved
  // 3a. mode='api': POST to Beehiiv API with html_content, tags, status='draft'.
  //     On success: update draft.beehiivPostId + .beehiivPostUrl, status='exported'.
  //     On API failure: return error; operator can retry as 'manual'.
  // 3b. mode='manual': return { html, deepLink } for caller to render side panel + clipboard.
  //     Caller updates status='exported' on confirmation that operator copied successfully.
  // 4. Whichever mode: status='exported', NOT 'published'. Editor goes read-only.
}

export async function setAsPublished(draftId: string, params: {
  publishedUrl?: string;
  publishedAt?: Date;
}): Promise<void> {
  // Operator-initiated. Called from studio "Set as published" button or CLI.
  // Verifies status='exported' (can't skip from approved → published; must export first).
  // Sets status='published', published_at, beehiiv_post_url.
}

export async function cancelExport(draftId: string, reason: string): Promise<void> {
  // Reverts exported → approved if operator needs to make further edits before publish.
  // Records reason in draft.metadata for retro learning.
}
```

#### UI surfacing

Editor footer state indicator:

| State | Indicator | Actions |
|---|---|---|
| draft | "draft · factcheck <status>" | Approve / Reject / Regenerate section |
| approved | "approved · ready to export" | Export to Beehiiv (api) / Export to Beehiiv (manual) |
| exported | "exported · awaiting send confirmation" + Beehiiv URL | Set as published / Cancel export |
| published | "published <date> · <Beehiiv URL>" | (read-only) |
| rejected | "rejected · <reason>" | Restore to draft |
| archived | "archived" | Restore to draft |

Operator never sees a "published" indicator until they explicitly confirm the email was sent. No misleading state.

### 3.12 Telemetry + cost monitoring

`lib/authoring/cost.ts` computes per-token cost using model price tables (kept in `lib/authoring/pricing.ts`, separate from cp4's `lib/membership/pricing.ts`). Updated when Anthropic changes prices.

Aggregation queries on `authoring_runs`:
- 7-day rolling cost average per content_type
- Cache hit-rate (cacheReadTokens / (cacheReadTokens + cacheWriteTokens + non-cached inputTokens))
- Factcheck rejection rate (count where factcheckStatus='fail' / total)

Studio `/admin/telemetry` renders these. Sentry breadcrumb on each run; threshold alerts:
- Cost: 7-day avg > $0.50/piece for 3+ consecutive days → warning
- Cache hit-rate: 30-day < 60% → warning (something's wrong with prompt structure)
- Factcheck failures: >20% in any 7-day window → warning (model regression or prompt drift)

### 3.13 Voice analyzer (Phase 2, feature-flagged)

`lib/authoring/voice.ts` — **NOT BUILT in v1**. Acceptance criterion only requires the feature flag exists; the analyzer stub returns "not implemented." Implemented in P2 after ≥10 published pieces accumulate.

Spec for future me:
- Read all `status='published'` drafts
- Extract patterns: opening sentences, transitions, closing phrases
- Store in `authoring_voice_patterns` table (NOT in v1 schema)
- Inject as additional few-shot examples in subsequent generations
- Gated behind `AUTHORING_VOICE_ANALYZER=true` env var

This entry exists in the plan so we don't accidentally re-think this when it's time. It's deliberately minimal in v1 scope.

---

## 4. E2E tests (upfront)

### Pipeline (engine)
| Test | What it verifies | Impl |
|---|---|---|
| `authoring/test_generate_recap.ts` | CLI produces 6-section Sunday recap from a fixture game_id; matches format spec | Node test + DB fixture |
| `authoring/test_generate_preview.ts` | CLI produces 4-section Wednesday preview; each section has Setup/Signal/Counterpoint/WTW | Node test |
| `authoring/test_factcheck_catches_drift.ts` | Synthetic prompt forces a fabricated stat; factcheck rejects | Node test with mocked LLM response |
| `authoring/test_factcheck_tolerance.ts` | EPA −0.123 in source matches "−0.12" in output (rounding tolerance) | Node test |
| `authoring/test_prompt_cache_hit.ts` | After 2 generations of same content type, cache_read_tokens > 80% of system tokens | Node test against real Anthropic API in nightly job |
| `authoring/test_advisory_lock.ts` | Concurrent generation of same slug serializes; second call waits or fails-fast | Node test with two parallel awaits |
| `authoring/test_db_filesystem_sync.ts` | After generation, DB hash matches file hash | Node test |

### Studio UI
| Test | What it verifies | Impl |
|---|---|---|
| `tests/e2e/admin-auth.spec.ts` | `/admin` redirects to `/admin/login` without cookie; login → dashboard | Playwright |
| `tests/e2e/admin-rate-limit.spec.ts` | 6 wrong-password attempts → 5 succeed-with-error, 6th rate-limited | Playwright |
| `tests/e2e/admin-dashboard.spec.ts` | Dashboard renders 4 panels; "Generate now" button visible | Playwright |
| `tests/e2e/admin-draft-editor-save.spec.ts` | Edit textarea → blur → "saved" indicator | Playwright |
| `tests/e2e/admin-draft-editor-readonly.spec.ts` | Published draft renders read-only; Save button absent | Playwright |
| `tests/e2e/admin-draft-factcheck-block.spec.ts` | Factcheck-failed draft: Approve disabled until "approve anyway" confirmed | Playwright |
| `tests/e2e/admin-backlog-add.spec.ts` | Add backlog item → appears in list | Playwright |
| `tests/e2e/admin-voice-edit.spec.ts` | Voice editor saves prompt file to disk | Playwright + tmp prompts dir |
| `tests/e2e/admin-schedule-skip.spec.ts` | Skip slot → status='skipped' | Playwright |
| `tests/e2e/admin-telemetry.spec.ts` | Charts render; runs log paginates | Playwright |

### Beehiiv publish
| Test | What it verifies | Impl |
|---|---|---|
| `authoring/test_markdown_to_beehiiv_html.ts` | Markdown converter produces clean HTML matching golden file | Node test |
| `tests/e2e/admin-export-clipboard.spec.ts` | Export button shows HTML preview + clipboard copy success | Playwright |
| `authoring/test_beehiiv_api_publish.ts` | Mocked Beehiiv API call returns post_id; draft.published_url set | Node test (Beehiiv mocked) |

### Auth + security guards
| Test | What it verifies | Impl |
|---|---|---|
| `tests/e2e/admin-no-credential-leak.spec.ts` | `/admin/*` does not render any Anthropic API key or DB conn string in HTML | Playwright |
| `authoring/test_csrf_origin_check.ts` | Cross-origin POST to Server Action rejected | Node test |
| `authoring/test_admin_disabled_when_env_missing.ts` | Without `ADMIN_SESSION_KEY`, `/admin/*` returns 503 | Node test |

Total: 22 tests. Existing test runner (Node `--test` for unit, Playwright for E2E).

---

## 5. Simplification pass

Reviewed for cuts. Three considered, two cut:

- **Cut: Real-time WebSocket-based collaborative editing.** Considered. Cut — single-operator model makes it pure cost.
- **Cut: Rich-text WYSIWYG editor (Tiptap, ProseMirror).** Considered for the markdown editor. Cut — adds 100+ KB of client JS for a workflow where the operator is comfortable with markdown. Textarea + monospace + live save is the complete answer.
- **Kept: Filesystem mirror.** Considered eliminating (DB-only). Kept — git-versionable archive is genuinely useful (lets you `git log drafts/` to see your editorial history), and recovery from DB loss is trivial via reload-from-files.

One ambiguity flagged for codex: the **regenerate-section** action requires the LLM to know which existing section to leave alone. Implementation calls the LLM with the markdown so far + an instruction to rewrite only the named section. This is brittle if section headings drift. Mitigation: section names are matched on heading text exactly; if it's not found, the action fails with "section not found" rather than rewriting silently.

---

## 6. Adversarial review (codex)

**Status:** pending. Run `/adversarial-review` after initial commit. Findings + responses captured in `e10b-ai-authoring-plan-adversarial-review.md`.

Anticipated lines of attack:
- LLM cost forecast is optimistic; real cost may be 2–3× the $0.50/piece target
- Per-section regenerate creates a markdown-merge problem that's underspecified
- Single-operator auth via env-key cookie has subtle replay risks if cookie leaks
- DB+filesystem dual-write isn't transactional; partial failures leave drift
- Voice exemplar #1 is one preview; voice generalizes poorly to other content types
- Factcheck heuristic on "proper noun ≠ player" is brittle (coach names, place names, opponent team names)
- prompt-cache hit rate >80% may be optimistic given cron's 5-min TTL

Section to be rewritten post-codex.

---

## 7. Task breakdown

Naming: P0 = critical path before season opener; P1 = required before paid flip; P2 = ongoing.

### Block P0 — pipeline + studio MVP (May–Aug 2026)

| ID | Title | Why | Acceptance |
|---|---|---|---|
| L0-01 | Drizzle schema + migration `00XX_authoring_studio.sql` | Foundation. v2 schema (post-codex CRITICAL #1): authoring_drafts has markdown_content text NOT NULL; no filepath column. State CHECK includes draft|approved|exported|published|rejected|archived. | Migration applied to prod; 4 tables + indexes + CHECK constraints present; markdown_content NOT NULL; status CHECK matches state machine §3.11; rollback path documented |
| L0-02 | `prompts/system.md` + `prompts/voice-exemplars.md` + `AUTHORING.md` | Voice + content guidelines | Files committed; voice exemplar #1 from lnv notes ported in; AUTHORING.md inlined into system prompt |
| L0-03 | Format spec docs: `prompts/format-recap.md` + `prompts/format-opponent-preview.md` | Format = differentiation | Both files committed; opponent-preview format matches lnv design entry §17 (Setup/Signal/Counterpoint/WTW) |
| L0-04 | Extractor: opponent preview (`lib/authoring/extractors/opponent-preview.ts`) | Pipeline input | Pure function; reads existing DAL; returns ExtractorContext with numericClaims + playerNames pre-extracted; unit test with fixture |
| L0-05 | Extractor: Sunday recap (`lib/authoring/extractors/recap.ts`) | Pipeline input | Same shape as L0-04; unit test |
| L0-06 | LLM call + prompt-caching (`lib/authoring/generate.ts` core) | The engine | Calls Anthropic SDK; cache_control on system block; cost calculated; advisory lock acquired/released |
| L0-07 | Hallucination guard with allowlists (`lib/authoring/factcheck.ts` + `factcheck-allowlist.ts`) | Trust. v2 (post-codex WARNING #2): allowlists for teams (32) + cities + coaches + stadiums + football common nouns. Player-name detection uses FirstName-LastName regex, not bare capitalization. | Numerics cross-checked with 0.005 tolerance; allowlists prevent flagging "Bills"/"Buffalo"/"AFC"/"Wk"; regression tests cover both fabricated player ("Jorge Velasquez" fails) and real teams ("Bills at Buffalo" passes); approve-anyway override metric instrumented |
| L0-08 | Draft persistence — DB-only (`authoring_drafts.markdown_content`) | v2 (post-codex CRITICAL #1): no filesystem mirror. Vercel filesystem is read-only/ephemeral. Drafts live in Postgres only. Atomic UPDATE — no dual-write. | Save updates markdown_content + content_sha256 atomically; concurrent edit detection via sha256 conflict (409); E2E save-on-blur passes |
| L0-09 | CLI entrypoint (`scripts/authoring-generate.ts`) | One trigger | `pnpm authoring:generate recap <game_id>` and `... preview <opponent> <week>` work end-to-end |
| L0-10 | Auth middleware (cookie + bearer) + login route | v2 (post-codex CRITICAL #2): dual-path auth. Cookie for browser, Bearer token for cron. | `middleware.ts` accepts EITHER `Authorization: Bearer <AUTHORING_CRON_TOKEN>` OR `28t_admin_session` cookie; without either, /admin/* redirects to /admin/login and /api/authoring/* returns 401; login sets cookie; rate-limit on login; e2e tests cover both auth paths |
| L0-11 | Studio shell layout (`app/admin/layout.tsx`) | UX | Sidebar nav + top bar; dark mode; matches DESIGN.md; e2e renders |
| L0-12 | Dashboard `/admin` (4 panels) | First UX surface | Renders panels; "Generate now" works via Server Action; e2e test |
| L0-13 | Drafts list `/admin/drafts` + draft editor `/admin/drafts/[id]` | Core editor | Two-pane editor; live save Server Action; factcheck status bar; regenerate-section dropdown; approve/reject; export-to-Beehiiv panel |
| L0-14 | Backlog `/admin/backlog` (CRUD + state machine) | Topic queue | Add/edit/archive; filter by status/priority; used_in_draft link populated |
| L0-15 | Voice editor `/admin/voice` (read-only in v1) | v2 (post-codex WARNING #1): no Vercel filesystem write + no git. v1 ships read-only viewer. Editing is local-CLI workflow. | Lists prompts/*.md + AUTHORING.md; renders rendered + raw-source toggle; footer notes the local-edit-and-push workflow; no save/commit buttons present |
| L0-16 | Schedule view `/admin/schedule` + cron seeding | Calendar awareness | Auto-populates from E9 ScheduleSnapshot; lists past 14d / next 14d; skip slot action; move-backlog action |
| L0-17 | Cron workflow `.github/workflows/authoring-cron.yml` + `/api/authoring/cron-tick` + `/api/authoring/generate` routes | v2 (post-codex CRITICAL #2): cron sends `Authorization: Bearer $AUTHORING_CRON_TOKEN`. /cron-tick orchestrates per-tick; /generate is per-piece. | Workflow runs every 30min; sends Bearer header; cron-tick queries authoring_schedules; per-piece /generate calls succeed end-to-end; heartbeat row in authoring_runs; missed-tick Sentry alert if 4+ ticks pass without heartbeat; AUTHORING_CRON_TOKEN stored in GH secrets + Vercel env |
| L0-18 | Telemetry `/admin/telemetry` + cost calc | Ops visibility | Charts render (cost + cache hit + factcheck rejection); runs log paginates; Sentry threshold alerts wired |
| L0-19 | Markdown → Beehiiv HTML converter + manual export panel + state machine | Publish path A. v2 (post-codex WARNING #4): export sets state to `exported`, not `published`. | Custom renderer; matches DESIGN.md tokens inline; clipboard helper; manual export sets state=exported; "Set as published" button transitions exported→published with optional URL; e2e covers both transitions |
| L0-20 | Beehiiv API publish path + state transitions | Publish path B. v2: API call → state=exported (Beehiiv-side status='draft'); operator confirms → state=published. | API call uses lib/authoring/publish-beehiiv.ts; state goes approved→exported (NOT directly to published); cancelExport reverts exported→approved; e2e mocked Beehiiv response; published state captures URL + timestamp |
| L0-21 | `pnpm authoring:export` CLI for git-archive of published drafts | v2 (post-codex CRITICAL #1): replaces the runtime filesystem-mirror with a local-only periodic snapshot. Optional, post-publish. | scripts/authoring-export.ts pulls all status='published' drafts from prod DB and writes to drafts/<content_type>/<slug>.md; idempotent (skips files unchanged from DB); operator commits + pushes archive; documented in docs/runbook.md |
| L0-22 | All E2E + unit tests passing | Quality gate before any cron runs | 24 tests pass in CI (was 22 in v1, +2 for new auth-bearer-path + state-machine tests); existing 250 tests still pass |

### Block P1 — pre-paid-flip iteration (Sept–Oct 2026)

| ID | Title | Why | Acceptance |
|---|---|---|---|
| L1-01 | Generate 3 sample pieces; user voice review | Voice consistency check (lnv acceptance #6) | 1 recap + 1 preview + 1 deep dive; user confirms "sounds like 28 and Three"; voice exemplars iterated if needed |
| L1-02 | Sonnet vs Haiku eval on cost + quality | Lock production model | Eval doc captured in `docs/authoring/model-eval.md`; default model set in env; costs compared on same 3 pieces |
| L1-03 | Add 2–4 more voice exemplars (recap + deep dive types) | Generalize voice beyond preview | `prompts/voice-exemplars.md` gains samples for non-preview content types |
| L1-04 | Full extractor coverage for offseason content types | Year-round capability | Extractors for draft scouting, retrospective, schedule reaction, training-camp tracker built; each with unit test |
| L1-05 | Per-section regenerate UX hardening | Editor smoothness | If section heading missing → fail fast; if regenerate would shrink content >50% → warn-then-confirm; e2e |

### Block P2 — post-flip ongoing

| ID | Title | Why | Acceptance |
|---|---|---|---|
| L2-01 | Voice analyzer (Phase 2, feature-flagged) | Inject patterns from published archive | Behind `AUTHORING_VOICE_ANALYZER=true`; not enabled in prod by default; activated only after ≥10 published pieces |
| L2-02 | Quarterly retro on cost trend + factcheck rates | Operate with intention | Doc landed each quarter; intervention task created if metrics drift |

---

## 8. Out of scope

- Site-side member auth or paywall on dashboards (E10's defining boundary)
- Multi-author collaboration (single-operator only; no comments, no review threads)
- Voice analyzer Phase 2 in v1 (gated; built in L2-01)
- Editorial calendar generation from scratch (calendar lives in `docs/content-calendar.md` per cp4 P0-08)
- AI image generation for newsletters (Beehiiv handles header images; AI image gen is a separate epic if needed)
- A/B testing of subject lines (Beehiiv handles)
- Translation / localization
- Live in-game updates

---

## 9. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LLM cost exceeds $0.50/piece avg | Medium | Medium | L1-02 Haiku-vs-Sonnet eval; cost dashboard alerts at threshold |
| Voice generalizes poorly beyond preview type | Medium | High (Phase 2.5 fail) | L1-03 adds exemplars per content type before paid flip |
| Factcheck heuristic too brittle (false positives) | Medium | Medium | Approve-anyway escape hatch; tracked metric; tuning loop |
| Cron drift / silent miss | Low | High (missed paid send) | Heartbeat row in authoring_runs; Sentry alert if 4+ ticks miss |
| DB/filesystem drift after partial-failure | Low | Medium | startup `pnpm authoring:verify-sync`; manual reconciliation runbook |
| Beehiiv API breaking change | Low | Medium | Manual export path is the fallback; both paths tested |
| Anthropic prompt-cache TTL miss in cron context | Medium | Low | Acceptable — cache benefits within a single retry path; cross-run caching is bonus, not critical |
| Per-section regenerate produces malformed markdown | Medium | Low | Section heading exact-match guard; failure is loud not silent |
| Admin cookie leak | Low | High | HttpOnly+Secure+SameSite=Strict; rotation runbook; rate-limited login |
| Operator forgets to flip `paidLive` after gate passes | Medium | Low | Studio dashboard surfaces "paid_live=false but gate passed" warning |

---

## 10. Open decisions deferred to tasks

- Production model (Sonnet 4.6 vs Haiku 4.5) — locked in L1-02
- Additional voice exemplars per content type — collected in L1-03
- AUTHORING.md final structure — drafted in L0-02, iterated through L1-01
- Cron interval (30min vs 15min vs hourly) — start at 30min, tune in P2 if drift observed

---

## 11. Sign-off

- [ ] Plan reviewed by user
- [ ] /adversarial-review with codex run; findings captured in `e10b-ai-authoring-plan-adversarial-review.md`
- [ ] Tasks created in beads (L0-01 through L2-02)
- [ ] Plan v2 (post-adversarial) committed
