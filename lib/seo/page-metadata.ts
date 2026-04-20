import type { Metadata } from 'next';

/** Build a per-page Metadata object that wires title + description +
 *  dynamic OG image from the /og generator. The root layout's title
 *  template ("%s · 28 and Three") prefixes the short title automatically,
 *  and `metadataBase` resolves the relative /og URL. */

export type OgParams = {
  /** If omitted, falls back to the short page title. */
  title?: string;
  /** Mono uppercase eyebrow on the OG card (e.g., "PHASES"). */
  eyebrow?: string;
  /** Mono amber stat line (e.g., "+0.12 EPA/play"). */
  stat?: string;
  /** Large amber rank (e.g., "04"). */
  rank?: string;
};

export type PageMetadataInput = {
  /** Short page title — the root template prefixes "· 28 and Three". */
  title: string;
  /** 155-char-ish meta description. */
  description: string;
  /** OG payload. If absent, the card defaults to the brand wordmark. */
  og?: OgParams;
  /** Canonical path (absolute, starting with /). Optional. */
  canonical?: string;
  /** If true, emits robots: noindex — used for /status and /tokens. */
  noindex?: boolean;
};

export function pageMetadata(input: PageMetadataInput): Metadata {
  const ogUrl = buildOgUrl({ ...input.og, title: input.og?.title ?? input.title });

  const meta: Metadata = {
    title: input.title,
    description: input.description,
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.canonical,
      siteName: '28 and Three',
      type: 'website',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: input.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [ogUrl],
    },
  };

  if (input.canonical) {
    meta.alternates = { canonical: input.canonical };
  }
  if (input.noindex) {
    meta.robots = { index: false, follow: false };
  }

  return meta;
}

function buildOgUrl(og: OgParams): string {
  const params = new URLSearchParams();
  if (og.title) params.set('title', og.title);
  if (og.eyebrow) params.set('eyebrow', og.eyebrow);
  if (og.stat) params.set('stat', og.stat);
  if (og.rank) params.set('rank', og.rank);
  const qs = params.toString();
  return qs ? `/og?${qs}` : '/og';
}
