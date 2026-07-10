import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EMPTY_STATES, type EmptyStateEntry, type EmptyStateKey } from "@/lib/empty-states";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  className?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
} & ({ state: EmptyStateEntry; stateKey?: never } | { state?: never; stateKey: EmptyStateKey });

export function EmptyState({
  className,
  onPrimary,
  onSecondary,
  state,
  stateKey,
}: EmptyStateProps) {
  const entry: EmptyStateEntry = state ?? EMPTY_STATES[stateKey];

  return (
    <div className={cn("mx-auto flex flex-col items-center px-6 py-12 text-center", className)}>
      <Image
        alt=""
        className="h-auto w-120 select-none"
        height={352}
        priority={false}
        src={`/illustrations/${entry.illu}.png`}
        width={352}
      />

      <h2 className="mt-6 font-heading text-xl font-medium text-ink">{entry.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{entry.desc}</p>

      {(entry.primary ?? entry.secondary) ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {entry.primary ? (
            <Button onClick={onPrimary}>
              <UiIcon name={entry.primary.icon} />
              {entry.primary.label}
            </Button>
          ) : null}
          {entry.secondary ? (
            <Button onClick={onSecondary} variant="secondary">
              <UiIcon name={entry.secondary.icon} />
              {entry.secondary.label}
            </Button>
          ) : null}
        </div>
      ) : null}

      {entry.chips ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {entry.chips.map((chip) => (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
              key={chip.label}
            >
              <UiIcon className="text-icon" name={chip.icon} size={14} />
              {chip.label}
            </span>
          ))}
        </div>
      ) : null}

      {entry.tip ? (
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground/80">{entry.tip}</p>
      ) : null}

      {entry.footer ? (
        <p className="mt-4 text-xs text-muted-foreground/80">{entry.footer}</p>
      ) : null}
    </div>
  );
}
