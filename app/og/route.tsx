import { ImageResponse } from 'next/og';
import { type OgParams, parseOgParams } from '@/lib/og/params';

// nodejs runtime: the edge sandbox in Next's dev server blocks outbound
// fetches; node runtime is stable in dev + prod. ImageResponse bundles
// its own Geist Regular fallback so no external font fetch is needed.
export const runtime = 'nodejs';

// Deep ink navy + bone + amber — design tokens mirrored from app/globals.css.
const BG = '#0B1520';
const TEXT = '#E8E6E1';
const TEXT_MUTED = '#8A96A3';
const POSITIVE = '#E0B44A';
const BORDER = '#2C3E55';

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const params = parseOgParams(searchParams);

  return new ImageResponse(<OgCard {...params} />, {
    width: 1200,
    height: 630,
  });
}

function OgCard({ title, eyebrow, stat, rank }: OgParams) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        color: TEXT,
        padding: 64,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            color: TEXT_MUTED,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          }}
        >
          {eyebrow}
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        {rank ? (
          <div
            style={{
              display: 'flex',
              fontSize: 240,
              fontWeight: 700,
              color: POSITIVE,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              marginRight: 48,
            }}
          >
            {rank}
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            gap: 24,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: '-0.025em',
              color: TEXT,
            }}
          >
            {title}
          </div>
          {stat ? (
            <div
              style={{
                display: 'flex',
                fontSize: 40,
                color: POSITIVE,
              }}
            >
              {stat}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 32,
          borderTop: `1px solid ${BORDER}`,
          fontSize: 22,
          color: TEXT_MUTED,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
        }}
      >
        <div style={{ display: 'flex' }}>
          <span style={{ color: TEXT }}>28</span>
          <span style={{ color: POSITIVE, margin: '0 10px' }}>and</span>
          <span style={{ color: TEXT }}>Three</span>
        </div>
        <div style={{ display: 'flex' }}>28andthree.com</div>
      </div>
    </div>
  );
}
