'use client';

import { useEffect, useState } from 'react';
import { SANDBOX_ACTIVE } from '@/lib/sandbox';

// Floating toolbar that lets sandbox users drop an annotation on the
// currently focused element. Posts to /api/sandbox-annotation, which
// calls `bd create`. Nothing ships to prod because SANDBOX_ACTIVE is
// false and the empty-stub alias erases this module from the bundle.
//
// Keep this minimal: one textarea, one button, one status line. The
// Agentation skill handles the rich workflow — this is just the bridge.
export function AgentationToolbar() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [selector, setSelector] = useState<string>('body');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!SANDBOX_ACTIVE) return;
    function onFocusIn(e: FocusEvent) {
      const target = e.target;
      if (target instanceof HTMLElement) {
        setSelector(describeElement(target));
      }
    }
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  if (!SANDBOX_ACTIVE) return null;

  async function submit() {
    if (!note.trim()) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch('/api/sandbox-annotation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          page: window.location.pathname,
          selector,
          note: note.trim(),
          priority: 2,
        }),
      });
      const json = await res.json();
      if (res.ok && json.taskId) {
        setStatus(`Filed ${json.taskId}`);
        setNote('');
      } else {
        setStatus(json.error ?? 'request failed');
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-sandbox-toolbar
      className="fixed bottom-4 right-4 z-50 w-80 rounded-md border border-border bg-surface shadow-elev-2"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-t-md bg-bg px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted hover:text-text"
      >
        Agentation {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="flex flex-col gap-2 p-3">
          <label className="text-xs text-muted">
            Target
            <div className="mt-1 truncate rounded border border-border bg-bg px-2 py-1 font-mono text-[11px] text-text">
              {selector}
            </div>
          </label>
          <label className="text-xs text-muted">
            Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm text-text"
              placeholder="What should change?"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !note.trim()}
            className="rounded bg-accent px-3 py-1 text-xs font-medium text-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Filing…' : 'File annotation'}
          </button>
          {status && <div className="text-xs text-muted">{status}</div>}
        </div>
      )}
    </div>
  );
}

function describeElement(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const data = Array.from(el.attributes).find((a) => a.name.startsWith('data-'));
  if (data) return `[${data.name}="${data.value}"]`;
  const cls = el.className && typeof el.className === 'string' ? el.className.split(/\s+/)[0] : '';
  return cls ? `${el.tagName.toLowerCase()}.${cls}` : el.tagName.toLowerCase();
}
