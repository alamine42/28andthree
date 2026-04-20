// Internal route used by E1-02c visual regression baseline and by the runtime
// token assertion in tests/e2e/e1.spec.ts. Not linked from navigation; excluded
// from sitemap later.

import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Design tokens',
  description: 'Design system tokens — internal reference.',
  noindex: true,
});

type TokenRow = { key: string; label: string; cssVar: string };

const DARK_TOKENS: TokenRow[] = [
  { key: 'bg', label: 'Background', cssVar: '--bg' },
  { key: 'surface', label: 'Surface', cssVar: '--surface' },
  { key: 'surface-2', label: 'Surface 2', cssVar: '--surface-2' },
  { key: 'border', label: 'Border', cssVar: '--border' },
  { key: 'border-strong', label: 'Border Strong', cssVar: '--border-strong' },
  { key: 'text', label: 'Text', cssVar: '--text' },
  { key: 'text-muted', label: 'Text Muted', cssVar: '--text-muted' },
  { key: 'text-dim', label: 'Text Dim', cssVar: '--text-dim' },
  { key: 'accent', label: 'Accent (Pats Red)', cssVar: '--accent' },
  { key: 'accent-dim', label: 'Accent Dim', cssVar: '--accent-dim' },
  { key: 'positive', label: 'Positive (Amber)', cssVar: '--positive' },
  { key: 'positive-dim', label: 'Positive Dim', cssVar: '--positive-dim' },
  { key: 'negative', label: 'Negative', cssVar: '--negative' },
  { key: 'chart-neutral', label: 'Chart Neutral', cssVar: '--chart-neutral' },
];

export default function TokensPage() {
  return (
    <section className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">Internal</p>
        <h1 className="font-display text-2xl font-bold tracking-tighter text-text">
          DESIGN.md tokens — dark mode
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3 lg:grid-cols-4">
        {DARK_TOKENS.map((token) => (
          <div
            key={token.key}
            data-testid={`token-${token.key}`}
            className="flex flex-col gap-2 bg-bg p-6"
            style={{ backgroundColor: `var(${token.cssVar})` }}
          >
            <span className="font-mono text-2xs uppercase tracking-widest text-text opacity-80 mix-blend-difference">
              {token.label}
            </span>
            <span className="font-mono text-2xs text-text opacity-80 mix-blend-difference">
              {token.cssVar}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
