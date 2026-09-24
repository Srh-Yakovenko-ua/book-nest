import type { ReactNode } from "react";

import { useId } from "react";

type PublisherOverviewSectionProps = {
  children: ReactNode;
  title: string;
};

export function PublisherOverviewSection({ children, title }: PublisherOverviewSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="font-heading text-sm font-semibold text-ink" id={headingId}>
        {title}
      </h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </section>
  );
}
