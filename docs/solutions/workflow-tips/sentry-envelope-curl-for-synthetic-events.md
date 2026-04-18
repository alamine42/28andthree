---
title: "Verify a Sentry DSN without a UI button — curl the envelope endpoint"
category: "workflow-tips"
date: "2026-04-17"
tags: [sentry, debugging, verification, curl, observability]
files: []
---

# Context

You wired Sentry, deployed, and want to confirm events are actually flowing to the right project — but Sentry's "Send Test Event" button has moved around the UI over the years and isn't always obvious. And adding a `throw new Error()` to prod-side code just to verify observability is exactly the kind of thing you should not do on a public site.

The clean path: send a synthetic event straight to Sentry's envelope API using curl + the DSN. No code changes, no SDK, no fake error routes.

# Guidance

Sentry's ingest protocol is the "envelope" format: an NDJSON-ish payload with three parts:

1. Envelope header: `event_id`, `sent_at`
2. Item header: `{"type": "event", "length": <bytes>, "content_type": "application/json"}`
3. Item payload: the JSON event itself (`message`, `level`, `tags`, etc.)

Each part is a single line, separated by `\n`. The `length` field on the item header is required.

Authentication is a single header: `X-Sentry-Auth: Sentry sentry_version=7, sentry_key=<public-key-from-DSN>, sentry_client=<anything>`.

# Examples

Given `NEXT_PUBLIC_SENTRY_DSN='https://<public>@o<org-id>.ingest.us.sentry.io/<project-id>'`:

```bash
PUBLIC_KEY='a8da35d3fc6928b19fc3b6117069ac57'
ORG_ID='o4511236797169664'
PROJECT_ID='4511236801298432'

TS=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
EVENT_ID=$(uuidgen | tr -d '-' | tr '[:upper:]' '[:lower:]')

PAYLOAD=$(printf '{"event_id":"%s","timestamp":"%s","platform":"javascript","level":"info","message":"wire-up verification","tags":{"source":"curl-synthetic"}}' "$EVENT_ID" "$TS")
LEN=${#PAYLOAD}

HEADER=$(printf '{"event_id":"%s","sent_at":"%s"}' "$EVENT_ID" "$TS")
ITEM_HEADER=$(printf '{"type":"event","length":%d,"content_type":"application/json"}' "$LEN")

ENVELOPE_FILE=$(mktemp)
printf '%s\n%s\n%s\n' "$HEADER" "$ITEM_HEADER" "$PAYLOAD" > "$ENVELOPE_FILE"

curl -s -X POST "https://${ORG_ID}.ingest.us.sentry.io/api/${PROJECT_ID}/envelope/" \
  -H "Content-Type: application/x-sentry-envelope" \
  -H "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${PUBLIC_KEY}, sentry_client=curl/8.0" \
  --data-binary @"$ENVELOPE_FILE" -w "\nHTTP:%{http_code}\n"
rm "$ENVELOPE_FILE"
```

HTTP 200 with `{"id":"<event_id>"}` = Sentry accepted it. Event appears in the project Issues/Discover tab within ~30s, filtered by `tags:source:curl-synthetic` or the specific `event_id`.

Two subtle gotchas that cost us a cycle:

1. **`length` field is required on the item header.** Leaving it off returns `400 invalid item envelope`.
2. **Events with `"level":"info"` show up under "All Issues" or Discover, NOT the default "Unresolved Errors" view.** If you filter to errors you won't see your test. Set `"level":"error"` and `"exception":{"values":[{"type":"TestError","value":"..."}]}` if you want it in the default view.

# References

- [Sentry Envelopes spec](https://develop.sentry.dev/sdk/envelopes/)
- [Sentry Data Protocol](https://develop.sentry.dev/sdk/event-payloads/)
- `sentry.server.config.ts`, `instrumentation-client.ts` — where the app's real Sentry wiring lives
