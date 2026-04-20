import type { Metadata } from 'next';
import { SectionHeader } from '@/components/SectionHeader';
import { pageMetadata } from '@/lib/seo/page-metadata';

export const metadata: Metadata = pageMetadata({
  title: 'Methodology',
  description:
    'How every number on 28 and Three gets made: data sources (nflverse, nfl4th), EPA, league rankings, draft ROI, coaching tendencies, and the limits we ship honestly.',
  og: {
    title: 'How every number on this site gets made',
    eyebrow: 'METHODOLOGY',
  },
  canonical: '/methodology',
});

// Static content page. No DB reads, no revalidation needed.
export const dynamic = 'force-static';

type TocItem = { id: string; label: string };

const TOC: ReadonlyArray<TocItem> = [
  { id: 'data-sources', label: 'Data sources' },
  { id: 'rankings', label: 'League rankings & EPA' },
  { id: 'tiebreaks', label: 'Rank tiebreaks' },
  { id: 'insufficient-sample', label: 'Small-sample rules' },
  { id: 'deltas', label: 'Deltas & trends' },
  { id: 'phases', label: 'The 12 phases of play' },
  { id: 'qb', label: 'Quarterback metrics' },
  { id: 'skill', label: 'Skill-position metrics' },
  { id: 'defense', label: 'Why individual defense is deferred' },
  { id: 'units', label: 'OL, DL & secondary units' },
  { id: 'draft-grade', label: 'Draft ROI grading' },
  { id: 'coaching', label: 'Coaching tendencies' },
  { id: 'coordinator-segments', label: 'Mid-season coaching changes' },
  { id: 'limitations', label: 'Limitations' },
  { id: 'refresh', label: 'Refresh cadence' },
  { id: 'attributions', label: 'Attributions' },
];

export default function MethodologyPage() {
  return (
    <article className="flex flex-col gap-12 py-12 md:gap-16 md:py-16">
      <header className="flex flex-col gap-5">
        <p
          className="font-mono text-2xs uppercase tracking-widest text-text-muted"
          data-testid="methodology-eyebrow"
        >
          Methodology
        </p>
        <h1 className="max-w-4xl font-display text-3xl font-bold leading-tight tracking-tightest text-text md:text-display">
          How every number on this site gets made.
        </h1>
        <p className="max-w-prose text-base text-text-muted md:text-lg">
          28 and Three is opinionated about what&rsquo;s in the box score. This
          page is the receipt: data sources, phase definitions, ranking rules,
          draft grading, coaching tendencies, and the limits we ship honestly.
        </p>
      </header>

      <TableOfContents />

      <Section
        eyebrow="01"
        title="Data sources"
        anchor="data-sources"
      >
        <Prose>
          <p>
            Everything on 28 and Three flows from public, attributable feeds.
            No proprietary PFF or NGS data; no paywalled APIs.
          </p>
          <ul>
            <li>
              <strong>nflverse</strong> via{' '}
              <a
                href="https://github.com/nflverse/nflreadpy"
                rel="noopener noreferrer"
                target="_blank"
                className="text-positive underline underline-offset-2 hover:text-text"
              >
                nflreadpy
              </a>{' '}
              — play-by-play from nflfastR (2020&ndash;current), schedules,
              rosters, draft picks, participation.
            </li>
            <li>
              <strong>nfl4th</strong> &mdash; Ben Baldwin&rsquo;s 4th-down
              win-probability model, used exclusively for the coaching-page
              4th-down ledger. Computed in the ETL, never at request time.
            </li>
            <li>
              <strong>Public NFL schedule</strong> &mdash; also via nflverse.
            </li>
          </ul>
          <p>
            All ingestion runs on a weekly GitHub Actions cron; see{' '}
            <a href="#refresh" className="text-positive underline underline-offset-2 hover:text-text">
              refresh cadence
            </a>
            .
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="02"
        title="League rankings & EPA"
        anchor="rankings"
      >
        <Prose>
          <p>
            Every phase rank on the site is measured against the full
            32-team league, not just the AFC East. Ranks 1&ndash;11 are
            top-third (amber), 12&ndash;21 neutral, 22&ndash;32 bottom-third
            (cranberry). Tier colors are stable regardless of how many teams
            met the small-sample threshold in a given week.
          </p>
          <p>
            The single-number summary is <strong>EPA per play</strong>
            &nbsp;&mdash; expected points added, averaged over the plays in a
            phase. EPA captures down, distance, field position, and game
            context in a way raw yards don&rsquo;t. We aggregate directly
            from nflfastR-computed EPA values; we do not refit the model.
          </p>
          <p>
            Explosive phases (
            <a href="#phases" className="text-positive underline underline-offset-2 hover:text-text">
              §06
            </a>
            ) are the exception: they&rsquo;re rate phases, not EPA phases,
            so the stored metric is the explosive-play share (0.0&ndash;1.0).
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="02.1"
        title="Rank tiebreaks"
        anchor="tiebreaks"
      >
        <Prose>
          <p>
            When two or more teams have identical EPA/play in a phase, ties
            break in this order &mdash; applied in the ETL aggregation query
            so ranks are stable across page loads.
          </p>
          <ol>
            <li>
              <strong>More plays</strong> in the phase (larger sample is more
              reliable).
            </li>
            <li>
              <strong>Higher success rate</strong> in the phase.
            </li>
            <li>
              <strong>Alphabetical team abbreviation</strong> (deterministic
              final fallback).
            </li>
          </ol>
          <p>
            EPA values are rounded to six decimals before comparison so
            floating-point noise from <code>AVG()</code> doesn&rsquo;t
            pre-empt the plays-count tiebreak.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="02.2"
        title="Small-sample rules"
        anchor="insufficient-sample"
      >
        <Prose>
          <p>
            Some phases have few plays in a given week &mdash; special teams
            in a clean game, red-zone offense when the team stalls. We never
            fabricate a number from thin air.
          </p>
          <ul>
            <li>
              <strong>Weekly:</strong> plays-in-phase &lt; 10 &rarr; metric
              renders as &ldquo;&mdash;&rdquo; with an <code>n &lt; 10</code>{' '}
              caveat. No weekly rank computed.
            </li>
            <li>
              <strong>Season-to-date:</strong> cumulative plays &lt; 30
              &rarr; no season rank. The team is excluded from the 1&ndash;32
              denominator for that phase that week.
            </li>
            <li>
              <strong>Rolling 4-week averages</strong> include only weeks
              where <code>n &ge; 10</code>.
            </li>
          </ul>
          <p>
            You will never see <code>NaN</code>, <code>null</code>,{' '}
            <code>undefined</code>, or bare <code>0</code> when the correct
            answer is &ldquo;not enough data&rdquo; &mdash; a dedicated e2e
            sweep (<code>tests/e2e/no-bad-numbers.spec.ts</code>) enforces
            this on every build.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="02.3"
        title="Deltas & trends"
        anchor="deltas"
      >
        <Prose>
          <p>
            <strong>Rank deltas</strong> compare the season-to-date rank
            against the same view from the prior season (or prior snapshot).
            A positive delta (▲) means the rank improved &mdash; rose on the
            board. Negative (▼) means it fell.
          </p>
          <p>
            <strong>EPA deltas</strong> are always signed (U+2212 for
            negatives) and display with two decimals. We use the real minus
            sign throughout, never a hyphen.
          </p>
          <p>
            Phase trend charts default to <strong>per-game EPA</strong>{' '}
            (season-to-date rolling average of per-game phase values), not
            per-play rolling averages. This smooths noise from 15-play
            red-zone weeks while keeping a game-by-game cadence.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="03"
        title="The 12 phases of play"
        anchor="phases"
      >
        <Prose>
          <p>
            Every home-page tile and phase-detail page aggregates one of
            twelve phases. Each phase has a fixed filter on the
            play-by-play dataset; changing a filter is a contract change
            that triggers a full backfill.
          </p>
          <ul>
            <li>
              <strong>Pass offense</strong> &mdash; EPA per dropback. Sacks +
              scrambles included.
            </li>
            <li>
              <strong>Rush offense</strong> &mdash; EPA per rush attempt. QB
              designed runs in; scrambles out.
            </li>
            <li>
              <strong>Pass defense</strong>, <strong>run defense</strong>{' '}
              &mdash; same filters, grouped by defensive team.
            </li>
            <li>
              <strong>Red-zone offense / defense</strong> &mdash; EPA on
              plays inside the 20.
            </li>
            <li>
              <strong>3rd-down offense / defense</strong> &mdash; EPA on 3rd
              downs only (4th downs live on the coaching page).
            </li>
            <li>
              <strong>Explosive offense / defense</strong> &mdash; rate
              phase. Pass &ge; 20 yards or run &ge; 15 yards counts as
              explosive. Metric stored is 0.0&ndash;1.0 share, not EPA.
            </li>
            <li>
              <strong>Special teams</strong> &mdash; EPA on punts, kickoffs,
              field goals, extra points.
            </li>
            <li>
              <strong>Overall</strong> &mdash; team EPA differential
              (offensive EPA/play minus defensive EPA/play allowed). A
              pass-offense-first team with average defense lands positive.
            </li>
          </ul>
          <p>
            The versioned filter contract lives at{' '}
            <code>docs/phase-definitions.md</code>, mirrored into{' '}
            <code>etl/transform/phases.py</code>.
          </p>
          <p>
            Global rules: regular-season only; garbage plays (kneels,
            spikes, 2-point attempts, nullified penalties) excluded from
            averages; no garbage-time filter (aligns with rbsdm / FTN).
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="04"
        title="Quarterback metrics"
        anchor="qb"
      >
        <Prose>
          <p>
            The QB page headline is <strong>EPA per dropback</strong>.
            Alongside it: CPOE (completion percentage over expected from
            nflfastR), aDOT (average depth of target), pressure rate, and
            clean-pocket vs. pressured splits on EPA.
          </p>
          <p>
            Default view is <strong>games as primary starter</strong> &mdash;
            games where the QB took more than 50% of team dropbacks. A
            toggle exposes every appearance. A small-sample banner appears
            below 100 season-to-date dropbacks because a handful of
            end-of-game snaps will otherwise distort splits.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="05"
        title="Skill-position metrics"
        anchor="skill"
      >
        <Prose>
          <p>
            RB / WR / TE pages surface target share, route participation,
            YAC per reception, EPA per target, aDOT, red-zone usage, and
            separation where nflverse participation data is available.
            EPA contribution rolls up to the player&rsquo;s side of the ball
            (receiving or rushing EPA), and that rollup feeds into{' '}
            <a href="#draft-grade" className="text-positive underline underline-offset-2 hover:text-text">
              draft grading
            </a>
            .
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="06"
        title="Why individual defense is deferred"
        anchor="defense"
      >
        <Prose>
          <p>
            We do not ship per-defender EPA ratings. Computing individual
            defensive value from nflverse alone is unreliable: participation
            data starts 2016 and is spotty; without PFF grades (out of
            scope) or premium NGS advanced-defense data, per-player numbers
            would be misleading more often than useful.
          </p>
          <p>
            The defense section instead publishes <strong>team-unit</strong>{' '}
            metrics: pressure rate, coverage EPA allowed, run-stop rate,
            explosive plays allowed. Honest callouts appear on the defense
            unit page where a reader might expect a per-player leaderboard.
          </p>
          <p>
            When a credible public data source appears, we&rsquo;ll revisit.
            Until then, shipping nothing beats shipping bad.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="07"
        title="OL, DL & secondary units"
        anchor="units"
      >
        <Prose>
          <p>
            The three unit pages surface aggregate EPA and proxy rates:
          </p>
          <ul>
            <li>
              <strong>Offensive line</strong> &mdash; pass-block / run-block
              win-rate proxies, pressures allowed, EPA on designed runs.
            </li>
            <li>
              <strong>Defensive line</strong> &mdash; pressure rate,
              run-stop rate, explosive runs allowed.
            </li>
            <li>
              <strong>Secondary / defense</strong> &mdash; coverage EPA
              allowed, explosive passes allowed.
            </li>
          </ul>
          <p>
            Pressure and block-rate proxies are derived from nflverse
            participation and play-result fields; they align with but are
            not identical to ESPN&rsquo;s published win-rate stats.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="08"
        title="Draft ROI grading"
        anchor="draft-grade"
      >
        <Prose>
          <p>
            Every Patriots pick 2021&ndash;2025 gets one of four grades:
          </p>
          <ul>
            <li>
              <strong className="text-positive">HIT</strong> &mdash; actual /
              slot-expected value &ge; 1.25.
            </li>
            <li>
              <strong>FAIR</strong> &mdash; ratio between 0.75 and 1.25.
            </li>
            <li>
              <strong className="text-negative">MISS</strong> &mdash; ratio
              &lt; 0.75.
            </li>
            <li>
              <strong>PENDING</strong> &mdash; pick is too recent
              (&lt; 2 seasons), is a specialist (K / P / LS), was traded out,
              or has missing inputs.
            </li>
          </ul>
          <p>
            <strong>Slot-expected value</strong> is a per-slot &times;
            position-bucket curve fit against league-wide 2015&ndash;2024
            outcomes. The curve uses isotonic (monotone) regression so
            later-round picks never exceed earlier-round picks in expected
            value.
          </p>
          <p>
            <strong>Skill positions</strong> (QB / RB / WR / TE) grade on
            EPA-weighted career contribution to date. <strong>Trenches
            and secondary</strong> (OL / DL / LB / DB) grade on a
            unit-proxy tier &mdash; the team unit&rsquo;s league rank during
            the player&rsquo;s active seasons. The unit-proxy modifier shows
            as an asterisk next to the grade so the reader can tell the
            grading surface apart.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="09"
        title="Coaching tendencies"
        anchor="coaching"
      >
        <Prose>
          <p>
            The coaching page renders weekly rollups per HC / OC / DC:
          </p>
          <ul>
            <li>
              <strong>Play-call mix</strong> &mdash; pass rate across a
              3&times;3 grid of down &times; distance buckets (short 0&ndash;3,
              mid 4&ndash;7, long 8+).
            </li>
            <li>
              <strong>Situational rates</strong> &mdash; shotgun alignment,
              play-action, pre-snap motion, no-huddle.
            </li>
            <li>
              <strong>Score-state pass rate</strong> &mdash; five bands from
              trailing 9+ through leading 9+. Expected pattern: pass-heavy
              when trailing, run-heavy when leading big.
            </li>
            <li>
              <strong>Personnel groupings</strong> &mdash; top-5 by share.
              11-personnel typically dominates; the long tail (12, 21, 22,
              13) colors the playbook&rsquo;s identity.
            </li>
            <li>
              <strong>Blitz rate</strong> &mdash; defensive 5+ rushers on
              the snap. NFL average is roughly 25%.
            </li>
            <li>
              <strong>4th-down ledger</strong> &mdash; week-by-week compare
              of each 4th-down decision against the nfl4th model&rsquo;s
              recommendation. Rows are bordered amber when the team agreed,
              cranberry when they diverged.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section
        eyebrow="09.1"
        title="Mid-season coaching changes"
        anchor="coordinator-segments"
      >
        <Prose>
          <p>
            When a coordinator changes mid-season, tendency rollups attach
            to the coach of record at the time of each play (SPEC §3.5a).
            The coaching page renders a segment per (role, continuous
            coach identity) &mdash; e.g., &ldquo;OC Weeks 1&ndash;6 · Coach
            A&rdquo; then &ldquo;OC Weeks 7&ndash;18 · Coach B&rdquo;. The
            &ldquo;changed&rdquo; pill on the coach card flags the split.
          </p>
          <p>
            Segment identity prefers <code>coach_id</code> from the source,
            falling back to a normalized name so a rename (e.g.,
            capitalization drift) doesn&rsquo;t produce phantom splits.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="10"
        title="Limitations"
        anchor="limitations"
      >
        <Prose>
          <ul>
            <li>
              <strong>No individual defender ratings.</strong> See{' '}
              <a href="#defense" className="text-positive underline underline-offset-2 hover:text-text">
                §06
              </a>
              .
            </li>
            <li>
              <strong>No garbage-time filter.</strong> A 4th-quarter
              collapse is legitimate signal for a fan site. Peers
              (rbsdm / FTN / Sumer) take the same stance.
            </li>
            <li>
              <strong>No playoff games in team-phase aggregates.</strong>{' '}
              Samples too small, opponent-skewed. Playoffs load to the raw
              plays table and feed player pages but sit out the 1&ndash;32
              rankings.
            </li>
            <li>
              <strong>Seasons 2020&ndash;current.</strong> Earlier seasons
              aren&rsquo;t backfilled; nflverse drift (column renames,
              participation data gaps) makes the multi-era stitching a
              larger project than v1 warrants.
            </li>
            <li>
              <strong>No PFF or premium NGS feeds.</strong> Public data
              only.
            </li>
          </ul>
        </Prose>
      </Section>

      <Section
        eyebrow="11"
        title="Refresh cadence"
        anchor="refresh"
      >
        <Prose>
          <p>
            The ETL runs on GitHub Actions crons:
          </p>
          <ul>
            <li>
              <strong>Tuesday 14:00 UTC</strong> &mdash; primary refresh,
              loads the previous week&rsquo;s play-by-play.
            </li>
            <li>
              <strong>Tuesday 18:00 + 22:00 UTC</strong> &mdash; retry
              windows if the primary run fails or nflverse hasn&rsquo;t
              published yet.
            </li>
            <li>
              <strong>Wednesday 06:00 UTC</strong> &mdash; watchdog. Opens
              an issue if no <code>status=&lsquo;ok&rsquo;</code> row has
              landed since Monday 00:00.
            </li>
          </ul>
          <p>
            Every run writes a row to <code>meta_refresh</code> with
            status (<code>running / ok / failed / heartbeat</code>), row
            counts per table, and source version. The footer&rsquo;s
            &ldquo;Last refresh&rdquo; pulls from the latest{' '}
            <code>ok</code> row.
          </p>
          <p>
            Pages are ISR-cached with a 1-hour TTL as fallback, but the
            ETL also calls an on-demand revalidation webhook after a
            successful run so fresh data appears within seconds of the
            backend update.
          </p>
        </Prose>
      </Section>

      <Section
        eyebrow="12"
        title="Attributions"
        anchor="attributions"
      >
        <Prose>
          <p>
            28 and Three is an independent fan project. It is not
            affiliated with, endorsed by, or sponsored by the New England
            Patriots, the NFL, or any of its teams.
          </p>
          <p>
            Play-by-play data and rosters:{' '}
            <a
              href="https://github.com/nflverse"
              rel="noopener noreferrer"
              target="_blank"
              className="text-positive underline underline-offset-2 hover:text-text"
            >
              nflverse
            </a>
            , specifically{' '}
            <a
              href="https://github.com/nflverse/nflfastR"
              rel="noopener noreferrer"
              target="_blank"
              className="text-positive underline underline-offset-2 hover:text-text"
            >
              nflfastR
            </a>{' '}
            and{' '}
            <a
              href="https://github.com/nflverse/nflreadpy"
              rel="noopener noreferrer"
              target="_blank"
              className="text-positive underline underline-offset-2 hover:text-text"
            >
              nflreadpy
            </a>
            .
          </p>
          <p>
            4th-down model:{' '}
            <a
              href="https://github.com/guga31bb/nfl4th"
              rel="noopener noreferrer"
              target="_blank"
              className="text-positive underline underline-offset-2 hover:text-text"
            >
              nfl4th
            </a>{' '}
            by Ben Baldwin.
          </p>
        </Prose>
      </Section>
    </article>
  );
}

function TableOfContents() {
  return (
    <nav
      aria-label="On this page"
      data-testid="methodology-toc"
      className="flex flex-col gap-3 rounded-md border border-border bg-surface p-5 md:p-6"
    >
      <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
        On this page
      </p>
      <ol className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
        {TOC.map((item, i) => (
          <li key={item.id} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="font-mono text-2xs tabular-nums text-text-muted"
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <a
              href={`#${item.id}`}
              className="flex min-h-[44px] flex-1 items-center text-sm text-text transition-colors hover:text-positive focus-visible:outline focus-visible:outline-2 focus-visible:outline-positive"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Section({
  eyebrow,
  title,
  anchor,
  children,
}: {
  eyebrow: string;
  title: string;
  anchor: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`methodology-section-${anchor}`}
      className="flex flex-col gap-4"
    >
      <SectionHeader eyebrow={eyebrow} title={title} anchor={anchor} />
      {children}
    </section>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-prose flex-col gap-3 text-base leading-relaxed text-text md:text-lg [&_a]:text-positive [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-text [&_code]:rounded-sm [&_code]:bg-surface [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_code]:text-text-muted [&_ol]:ml-5 [&_ol]:list-decimal [&_ul]:ml-5 [&_ul]:list-disc [&_li]:mb-1.5 [&_strong]:text-text">
      {children}
    </div>
  );
}
