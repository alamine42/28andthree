type Props = {
  eyebrow: string;
  title: string;
  anchor?: string;
  children?: React.ReactNode;
};

// Consistent section anchor for /coaching and friends. Mono uppercase
// eyebrow → H2 display title → optional aside slot. Kept deliberately
// minimal so each section below it defines its own visual weight.
export function SectionHeader({ eyebrow, title, anchor, children }: Props) {
  return (
    <header
      id={anchor}
      className="flex scroll-mt-24 flex-wrap items-baseline justify-between gap-3 border-b border-border-strong pb-3"
    >
      <div className="flex flex-col gap-1">
        <p className="font-mono text-2xs uppercase tracking-widest text-text-muted">
          {eyebrow}
        </p>
        <h2 className="font-display text-2xl font-bold leading-tight tracking-tightest text-text md:text-3xl">
          {title}
        </h2>
      </div>
      {children}
    </header>
  );
}
