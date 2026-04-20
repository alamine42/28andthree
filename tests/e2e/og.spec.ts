import { expect, test } from '@playwright/test';

// E6-02: /og generator returns a valid PNG for each page-type payload.
// PNG signature is the first 8 bytes: 89 50 4E 47 0D 0A 1A 0A.

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CASES: Array<{ name: string; query: string }> = [
  {
    name: 'home',
    query: 'title=New+England%2C+2025+in+one+page&eyebrow=TEAM',
  },
  {
    name: 'phase',
    query: 'title=Pass+offense&eyebrow=PHASES&stat=%2B0.12+EPA%2Fplay&rank=04',
  },
  {
    name: 'player',
    query: 'title=Drake+Maye&eyebrow=QB&stat=0.12+EPA%2Fdropback',
  },
];

test.describe('E6-02 /og', () => {
  for (const c of CASES) {
    test(`${c.name} payload returns a valid PNG`, async ({ request }) => {
      const res = await request.get(`/og?${c.query}`);
      expect(res.status()).toBe(200);

      const ct = res.headers()['content-type'] ?? '';
      expect(ct, `content-type for ${c.name}`).toContain('image/png');

      const body = await res.body();
      expect(body.length, `empty body for ${c.name}`).toBeGreaterThan(1000);
      expect(
        body.subarray(0, 8).equals(PNG_MAGIC),
        `invalid PNG signature for ${c.name}`,
      ).toBe(true);
    });
  }

  test('no query params falls back to the brand default', async ({ request }) => {
    const res = await request.get('/og');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
    const body = await res.body();
    expect(body.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
  });
});
