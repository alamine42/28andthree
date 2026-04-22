// E8 Sandbox — empty-stub module.
//
// next.config.ts aliases every sandbox fixture + stub module to this
// file when NEXT_PUBLIC_SANDBOX_MODE !== '1'. That guarantees no
// fixture bytes enter the prod bundle. Every exported symbol here is
// either a safe constant (SANDBOX_ACTIVE=false, isSandbox=false) or a
// throw-on-call stub — so any accidental prod invocation crashes loud
// in Sentry rather than silently returning a wrong fixture.
//
// If you add a new DAL stub function, mirror it here as a throw.

export const SANDBOX_ACTIVE = false as const;
export function isSandbox(): boolean {
  return false;
}

const THROW_MESSAGE =
  'sandbox stub hit in prod — this function was aliased out by next.config.ts but something called it anyway';

function sandboxThrow(): never {
  throw new Error(THROW_MESSAGE);
}

export function loadFixture(_key: string): never {
  sandboxThrow();
}

// DAL stub surface — mirrored from lib/sandbox/stubs/*.ts. Names match
// so webpack's alias resolution succeeds for every named import.
export function getTeamSeasonOverview(): never { sandboxThrow(); }
export function getRecentGames(): never { sandboxThrow(); }
export function getCurrentSeason(): never { sandboxThrow(); }
export function getPhaseRankSnapshot(): never { sandboxThrow(); }
export function getPatsPhaseSparklines(): never { sandboxThrow(); }
export function getPhaseDetail(): never { sandboxThrow(); }
export function getPhaseWeeklyTrend(): never { sandboxThrow(); }
export function getLeagueDistribution(): never { sandboxThrow(); }
export function getDraftRoiByClass(): never { sandboxThrow(); }
export function getCoachSegments(): never { sandboxThrow(); }
export function getFourthDownDecisions(): never { sandboxThrow(); }
export function getTopContributors(): never { sandboxThrow(); }

// Fixture-module surface (re-exports used by stubs). Throw on read.
export const teamOverview2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const recentGames2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const phaseSnapshot2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const sparklines2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const phaseDetails2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const phaseTrend2025: never = sandboxThrow as never;
export const phaseDistribution2025: never = sandboxThrow as never;
export const draftRoi: never = new Proxy({}, { get: sandboxThrow }) as never;
export const coachSegments2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const fourthDownDecisions2025: never = new Proxy({}, { get: sandboxThrow }) as never;
export const PHASES: never = new Proxy([], { get: sandboxThrow }) as never;
