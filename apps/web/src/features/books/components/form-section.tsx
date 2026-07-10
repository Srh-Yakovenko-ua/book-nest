import type { ReactNode } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

import { SectionCompleteBadge } from "./section-complete-badge";

type FormSectionProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  complete?: boolean;
  completeLabel?: string;
  description?: ReactNode;
  icon: UiIconName;
  title: ReactNode;
};

export function FormSection({
  action,
  children,
  className,
  complete = false,
  completeLabel,
  description,
  icon,
  title,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-detail-block md:p-6",
        className,
      )}
    >
      <header className="flex flex-wrap items-start gap-3">
        <div className="flex min-w-0 grow basis-64 items-center gap-3">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <UiIcon name={icon} size={18} />
            {complete ? <SectionCompleteBadge /> : null}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="font-heading text-base leading-tight font-semibold text-ink">
              {title}
              {complete && completeLabel ? (
                <span className="sr-only"> — {completeLabel}</span>
              ) : null}
            </h2>
            {description === undefined ? null : (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        {action === undefined ? null : <div className="ml-auto shrink-0">{action}</div>}
      </header>
      {children}
    </section>
  );
}
