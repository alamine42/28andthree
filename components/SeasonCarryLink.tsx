'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { parseSeasonParam, withSeason } from '@/lib/season-view';

// E11 (code review pass 2): link that carries an active ?season= forward
// from pages that render statically and cannot read the param server-side
// (e.g. draft-class player links). Renders the plain href during SSR and
// decorates after hydration — progressive enhancement, so the static
// page stays static.

function CarryLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const season = parseSeasonParam(searchParams.get('season'));
  return (
    <Link href={withSeason(href, season) as Route} className={className}>
      {children}
    </Link>
  );
}

export function SeasonCarryLink(props: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <Link href={props.href as Route} className={props.className}>
          {props.children}
        </Link>
      }
    >
      <CarryLink {...props} />
    </Suspense>
  );
}
