import Image from 'next/image';

type Props = {
  displayName: string;
  headshotUrl: string | null;
  size?: number;
};

// Player headshot or initials fallback. `next/image` handles format + sizing.
// When headshot_url is null (never captured or HEAD-check failed during ETL)
// we fall back to an initials bubble — no decorative fill, just token colors.
// Review finding #6: URL comes from nflreadpy roster data, not a hardcoded
// club-logo pattern.
export function PlayerAvatar({ displayName, headshotUrl, size = 64 }: Props) {
  if (!headshotUrl) {
    return <InitialsBubble displayName={displayName} size={size} />;
  }
  return (
    <Image
      src={headshotUrl}
      alt={`${displayName} headshot`}
      width={size}
      height={size}
      className="rounded-pill border border-border bg-surface"
      unoptimized
    />
  );
}

function InitialsBubble({ displayName, size }: { displayName: string; size: number }) {
  const initials = extractInitials(displayName);
  return (
    <span
      role="img"
      aria-label={`${displayName} (no headshot)`}
      className="inline-flex items-center justify-center rounded-pill border border-border bg-surface font-mono font-bold uppercase tracking-widest text-text"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </span>
  );
}

function extractInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  const first = parts[0]!.charAt(0);
  const last = parts[parts.length - 1]!.charAt(0);
  return `${first}${last}`.toUpperCase();
}
