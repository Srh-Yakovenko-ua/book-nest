import type { ReactNode } from "react";

import { useId } from "react";

type PublisherOverviewSectionProps = {
  children: ReactNode;
  title: string;
};

export function PublisherOverviewSection({ children, title }: PublisherOverviewSectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft"
    >
      <h2 className="font-heading text-lg font-semibold text-ink" id={headingId}>
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-border/70">{children}</ul>
    </section>
  );
}
