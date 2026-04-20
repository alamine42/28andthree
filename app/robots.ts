import type { MetadataRoute } from 'next';

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '') ?? 'https://28andthree.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // /status + /tokens are also page-level noindex (E6-03) but calling
        // it out here saves crawler requests. /og, /api paths have no
        // indexable content to offer.
        disallow: ['/status', '/status/', '/tokens', '/tokens/', '/og', '/api/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
