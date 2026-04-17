---
title: "Dropping preview-per-PR infrastructure for a solo project"
category: "architecture"
date: "2026-04-17"
tags: [architecture, solo-dev, vercel, neon, branch-strategy, ci-cd]
files: [docs/plans/e1-foundation-plan.md, docs/runbook.md]
---

# Single-branch workflow — why we dropped preview-per-PR

## Context

Early E1 planning wired a full preview-per-PR stack:
- Require PR + 1 approving review as branch protection
- Neon-Vercel integration auto-creates a per-PR Neon DB branch
- `.github/workflows/preview-migrate.yml` runs `drizzle-kit migrate` against the per-PR branch before Vercel publishes the preview
- `PREVIEW_MIGRATOR_DATABASE_URL` secret provisioned

Every piece had a justification on paper. When we stepped back, the whole scaffold was solving a problem a solo dev doesn't have.

## Guidance

**For solo or near-solo projects, don't ship preview-per-PR infrastructure up front.** The "require 1 review" gate is self-bypass theater (GitHub disallows approving your own PR; you end up using `--admin` bypass on every merge). Once you drop that, per-PR DB branches, preview-migrate workflows, and the Neon-Vercel integration all become machinery without a job.

**What you keep from the "PR-heavy" playbook:**
- Branch protection that blocks force-push, deletions, and non-linear history (free insurance, no self-conflict)
- `CODEOWNERS` for when a collaborator eventually joins
- Vercel auto-previews for any branch push (default behavior, needs zero setup)
- Ability to create a Neon branch manually when a specific change warrants a preview DB

**What you can honestly drop until a collaborator shows up:**
- Required PR reviews
- Per-PR Neon branches
- Preview-migrate automation
- The corresponding `PREVIEW_MIGRATOR_DATABASE_URL` secret

**Tradeoff you take on:** schema changes go direct to prod via `pnpm db:migrate` against `MIGRATOR_DATABASE_URL`. Mitigation: test risky migrations on the `dev` Neon branch first (`MIGRATOR_DATABASE_URL=<dev-owner> pnpm db:migrate`), and treat schema PRs like risky changes — open a branch, Vercel auto-previews it, verify, then merge.

## Examples

**When to keep it simple (single branch):**
- Solo dev, pre-launch, small schema
- Few collaborators, high-trust
- Migrations are infrequent / reversible

**When to reinstate preview-per-PR:**
- Second engineer joins → enable required reviews, and at that point preview-per-PR + preview-migrate pull their weight again
- Public repo with external contributors
- Migrations become frequent and risky (e.g., 5+ schema PRs per week)

## References

- `docs/plans/e1-foundation-plan.md` §3.4 — environments table post-simplification
- `docs/plans/e1-foundation-plan-adversarial-review.md` — the finding that made us rethink ("self-bypass theater")
- `docs/runbook.md#schema-changes` — current migration workflow
- commit `a26d5ce` — deletion of preview-migrate workflow + simplification
