import type { Ref } from "react";

import Image from "next/image";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ILLU_SIZE = {
  lg: "h-84 w-auto",
  md: "h-70 w-auto",
  sm: "h-56 w-auto",
} as const;

type EmptyStateProps = {
  className?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryRef?: Ref<HTMLButtonElement>;
  state: EmptyStateEntry;
};

export function EmptyState({
  className,
  onPrimary,
  onSecondary,
  primaryRef,
  state,
}: EmptyStateProps) {
  const illuSizeClass = ILLU_SIZE[state.illuSize ?? "lg"];

  return (
    <div className={cn("mx-auto flex flex-col items-center px-6 py-6 text-center", className)}>
      <Image
        alt=""
        className={cn("select-none", illuSizeClass)}
        height={352}
        loading="eager"
        src={`/illustrations/${state.illu}.png`}
        width={352}
      />

      <h2 className="mt-6 font-heading text-xl font-medium text-ink">{state.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.desc}</p>

      {(state.primary ?? state.secondary) ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {state.primary ? (
            <Button onClick={onPrimary} ref={primaryRef}>
              <UiIcon name={state.primary.icon} />
              {state.primary.label}
            </Button>
          ) : null}
          {state.secondary ? (
            <Button onClick={onSecondary} variant="secondary">
              <UiIcon name={state.secondary.icon} />
              {state.secondary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
