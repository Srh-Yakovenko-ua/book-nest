import type { Ref } from "react";

import Image from "next/image";

import type {
  EmptyStateEntry,
  EmptyStateIllustrationSize,
  EmptyStateLayout,
} from "@/lib/empty-states";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ILLU_SIZE = {
  lg: "h-84 w-auto",
  md: "h-70 w-auto",
  sm: "h-56 w-auto",
  xs: "h-36 w-auto",
} as const satisfies Record<EmptyStateIllustrationSize, string>;

const EMPTY_STATE_LAYOUT = {
  inline: {
    actions: "mt-4 justify-center sm:justify-start",
    art: "shrink-0",
    copy: "flex max-w-md flex-col items-center sm:items-start",
    root: "gap-4 sm:flex-row sm:justify-center sm:gap-8 sm:text-left",
    title: "",
  },
  stacked: {
    actions: "mt-6 justify-center",
    art: "",
    copy: "contents",
    root: "",
    title: "mt-6",
  },
} as const satisfies Record<
  EmptyStateLayout,
  Record<"actions" | "art" | "copy" | "root" | "title", string>
>;

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
  const layout = EMPTY_STATE_LAYOUT[state.layout ?? "stacked"];

  return (
    <div
      className={cn(
        "mx-auto flex flex-col items-center px-6 py-6 text-center",
        layout.root,
        className,
      )}
    >
      <Image
        alt=""
        className={cn("select-none", illuSizeClass, layout.art)}
        height={352}
        loading="eager"
        src={`/illustrations/${state.illu}.png`}
        width={352}
      />

      <div className={layout.copy}>
        <h2 className={cn("font-heading text-xl font-medium text-ink", layout.title)}>
          {state.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{state.desc}</p>

        {(state.primary ?? state.secondary) ? (
          <div className={cn("flex flex-wrap items-center gap-2", layout.actions)}>
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
    </div>
  );
}
