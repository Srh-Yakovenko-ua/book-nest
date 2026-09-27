import type { ReactNode } from "react";

import { useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type TimelineFormSectionCollapse = {
  onToggle: () => void;
  open: boolean;
  summary?: string;
};

type TimelineFormSectionProps = {
  children: ReactNode;
  collapse?: TimelineFormSectionCollapse;
  icon: UiIconName;
  subtitle?: string;
  title: string;
};

export function TimelineFormSection({
  children,
  collapse,
  icon,
  subtitle,
  title,
}: TimelineFormSectionProps) {
  const contentId = useId();
  const isOpen = collapse === undefined || collapse.open;
  const collapsedSummary = collapse === undefined || collapse.open ? undefined : collapse.summary;

  const header = (
    <>
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"
      >
        <UiIcon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-heading text-sm leading-tight font-semibold text-ink">{title}</span>
        {subtitle === undefined ? null : (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
        {collapsedSummary === undefined ? null : (
          <span className="truncate text-xs text-foreground">{collapsedSummary}</span>
        )}
      </span>
      {collapse === undefined ? null : (
        <UiIcon
          aria-hidden
          className="mt-1 shrink-0 text-muted-foreground"
          name={collapse.open ? "chevron-up" : "chevron-down"}
          size={16}
        />
      )}
    </>
  );

  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card p-4 text-card-foreground shadow-detail-block",
        isOpen && "gap-4",
      )}
    >
      {collapse === undefined ? (
        <div className="flex items-start gap-3">{header}</div>
      ) : (
        <button
          aria-controls={contentId}
          aria-expanded={collapse.open}
          className="flex w-full cursor-pointer items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={collapse.onToggle}
          type="button"
        >
          {header}
        </button>
      )}
      {isOpen ? (
        <div className="flex flex-col gap-4" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
