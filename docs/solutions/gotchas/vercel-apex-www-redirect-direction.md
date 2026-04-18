---
title: "Vercel defaults apex → www redirect; flipping direction requires the API"
category: "gotchas"
date: "2026-04-17"
tags: [vercel, dns, domains, canonical-url, api]
files: []
---

# Vercel's apex ↔ www redirect default isn't what you want

## Problem

After aliasing a prod deploy to both `28andthree.com` (apex) and `www.28andthree.com`, the site served this:

```
$ curl -sI https://28andthree.com
HTTP/2 307
location: https://www.28andthree.com/

$ curl -sI https://www.28andthree.com
HTTP/2 200
```

apex was redirecting to www. Most modern sites want the opposite: apex canonical, www redirects to apex (cleaner URLs, better for sharing/SEO).

The Vercel CLI has no `vercel domain set-canonical` or equivalent — the direction is determined by whichever domain gets added to the project first, and `vercel alias set` doesn't expose the redirect config.

## Root Cause

Vercel's project-domain config has a `redirect` field per domain. When both apex and www are attached, Vercel auto-populates `apex.redirect = "www.apex"` (or the opposite) based on first-added — and doesn't surface this in the CLI.

## Solution

PATCH the project domain config directly via the Vercel API:

```bash
VERCEL_TOKEN=$(cat "$HOME/Library/Application Support/com.vercel.cli/auth.json" | \
  python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))')
PROJECT_ID="<from .vercel/project.json>"
TEAM_ID="<from .vercel/project.json>"

# 1. Clear apex redirect (make apex canonical)
curl -s -X PATCH \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/apex.com?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"redirect": null}'

# 2. Set www → apex redirect
curl -s -X PATCH \
  "https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/www.apex.com?teamId=${TEAM_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"redirect": "apex.com", "redirectStatusCode": 308}'
```

308 (Permanent Redirect) is the right status — 301 works too but 308 preserves method + body for POSTs.

Verify:
```bash
curl -sI https://apex.com       # HTTP/2 200
curl -sI https://www.apex.com   # HTTP/2 308, location: https://apex.com/
```

## Prevention

- **Decide apex vs www canonical before adding both domains to Vercel.** Add the canonical first; it defaults correctly.
- If you added both in the wrong order (common), use the API to flip it — don't waste time fighting the CLI.
- For other registrars/CDNs (Cloudflare, Netlify), the pattern is similar: there's a config surface somewhere for redirect direction, but it's almost never exposed in the primary CLI/UI.

## Related

- `.vercel/project.json` — holds `projectId` and `orgId` (team ID)
- commit `e0227ab` — "DNS: 28andthree.com live (apex canonical, www → apex 308)"
- [Vercel Project Domain API](https://vercel.com/docs/rest-api/endpoints/projects#update-a-project-domain)
