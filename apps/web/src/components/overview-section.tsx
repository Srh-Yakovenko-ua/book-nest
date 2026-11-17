import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function OverviewSection({
  children,
  className,
  title,
}: {
  children: ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}
