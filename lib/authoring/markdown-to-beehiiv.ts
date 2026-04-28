// Markdown → Beehiiv-safe HTML converter. Per plan §3.11 + L0-19.
//
// Beehiiv's editor accepts inline-styled HTML with a permissive subset of
// tags. We use minimal, no-class HTML with inline DESIGN.md token colors,
// rendered without any external CSS.
//
// Design choices:
// - h1 in markdown is dropped — Beehiiv has its own title field.
// - h2/h3 get inline-styled headings; preserve hierarchy.
// - Links get utm_source=newsletter appended.
// - Real minus sign U+2212 preserved.
// - Tables, code blocks, lists handled minimally — no syntax highlighting.

const TOKENS = {
  bg: '#0B1520',
  text: '#E8E6E1',
  textMuted: '#8A96A3',
  accent: '#C81E36',
  positive: '#1ABE58',
  negative: '#D9707F',
  border: '#1F2D3D',
};

export function markdownToBeehiivHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) out.push('<pre style="font-family:monospace;background:#121E2B;padding:12px;overflow-x:auto;">');
      else out.push('</pre>');
      continue;
    }
    if (inCodeBlock) {
      out.push(escapeHtml(line));
      continue;
    }

    // h1 — drop (Beehiiv has its own title)
    if (line.startsWith('# ')) continue;

    // h2
    if (line.startsWith('## ')) {
      closeListsIfOpen(out, { inList, inOrderedList });
      inList = false;
      inOrderedList = false;
      out.push(
        `<h2 style="font-family:Georgia,serif;font-weight:700;font-size:24px;line-height:1.2;margin:24px 0 12px;color:${TOKENS.text};">${inline(line.slice(3))}</h2>`,
      );
      continue;
    }

    // h3
    if (line.startsWith('### ')) {
      closeListsIfOpen(out, { inList, inOrderedList });
      inList = false;
      inOrderedList = false;
      out.push(
        `<h3 style="font-family:Georgia,serif;font-weight:700;font-size:18px;margin:20px 0 8px;color:${TOKENS.text};">${inline(line.slice(4))}</h3>`,
      );
      continue;
    }

    // unordered list item
    if (/^[-*]\s/.test(line)) {
      if (!inList) {
        if (inOrderedList) {
          out.push('</ol>');
          inOrderedList = false;
        }
        out.push(`<ul style="margin:8px 0;padding-left:20px;color:${TOKENS.text};">`);
        inList = true;
      }
      out.push(`<li style="margin:4px 0;">${inline(line.replace(/^[-*]\s/, ''))}</li>`);
      continue;
    }

    // ordered list item
    if (/^\d+\.\s/.test(line)) {
      if (!inOrderedList) {
        if (inList) {
          out.push('</ul>');
          inList = false;
        }
        out.push(`<ol style="margin:8px 0;padding-left:20px;color:${TOKENS.text};">`);
        inOrderedList = true;
      }
      out.push(`<li style="margin:4px 0;">${inline(line.replace(/^\d+\.\s/, ''))}</li>`);
      continue;
    }

    // blank line — close any open lists, emit a paragraph break
    if (line.trim() === '') {
      closeListsIfOpen(out, { inList, inOrderedList });
      inList = false;
      inOrderedList = false;
      continue;
    }

    // paragraph
    closeListsIfOpen(out, { inList, inOrderedList });
    inList = false;
    inOrderedList = false;
    out.push(
      `<p style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.7;margin:12px 0;color:${TOKENS.text};">${inline(line)}</p>`,
    );
  }
  closeListsIfOpen(out, { inList, inOrderedList });

  return [
    `<div style="font-family:system-ui,sans-serif;background:${TOKENS.bg};color:${TOKENS.text};padding:24px;">`,
    out.join('\n'),
    '</div>',
  ].join('\n');
}

function closeListsIfOpen(
  out: string[],
  state: { inList: boolean; inOrderedList: boolean },
): void {
  if (state.inList) out.push('</ul>');
  if (state.inOrderedList) out.push('</ol>');
}

function inline(text: string): string {
  let s = escapeHtml(text);
  // Bold **x**
  s = s.replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${TOKENS.text};">$1</strong>`);
  // Italic *x* (be careful not to match leftover bold markers)
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Inline code `x`
  s = s.replace(
    /`([^`]+)`/g,
    `<code style="font-family:monospace;background:#121E2B;padding:2px 4px;border-radius:2px;color:${TOKENS.text};">$1</code>`,
  );
  // Links [text](url) → utm_source appended
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
    const sep = url.includes('?') ? '&' : '?';
    const taggedUrl = `${url}${sep}utm_source=newsletter`;
    return `<a href="${taggedUrl}" style="color:${TOKENS.accent};text-decoration:underline;">${label}</a>`;
  });
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
