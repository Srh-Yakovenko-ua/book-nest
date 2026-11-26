import type { ReactNode } from "react";

import { useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type GoalOverviewCardProps = {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  icon: UiIconName;
  title: string;
};

export function GoalOverviewCard({
  aside,
  children,
  className,
  icon,
  title,
}: GoalOverviewCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-soft sm:p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="inline-flex min-w-0 items-center gap-2.5 font-heading text-lg font-semibold text-ink"
          id={headingId}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-icon">
            <UiIcon name={icon} size={16} />
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
