import type { ReactNode } from "react";

import { UiIcon, type UiIconName } from "@/components/icons";

type FormSectionProps = {
  children: ReactNode;
  description?: ReactNode;
  icon: UiIconName;
  title: ReactNode;
};

export function FormSection({ children, description, icon, title }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-soft md:p-6">
      <header className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <UiIcon name={icon} size={18} />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="font-heading text-base leading-tight font-semibold text-ink">{title}</h2>
          {description === undefined ? null : (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
