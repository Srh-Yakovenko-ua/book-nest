import type { ReactNode } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";
import { cn } from "@/lib/utils";

import { SectionCompleteBadge } from "./section-complete-badge";

type FormSectionProps = {
  children: ReactNode;
  className?: string;
  complete?: boolean;
  completeLabel?: string;
  description?: ReactNode;
  icon: UiIconName;
  title: ReactNode;
};

export function FormSection({
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
      <header className="flex items-start gap-3">
        <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <UiIcon name={icon} size={18} />
          {complete ? <SectionCompleteBadge /> : null}
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-base leading-tight font-semibold text-ink">
            {title}
            {complete && completeLabel ? <span className="sr-only"> — {completeLabel}</span> : null}
          </h2>
          {description === undefined ? null : (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
