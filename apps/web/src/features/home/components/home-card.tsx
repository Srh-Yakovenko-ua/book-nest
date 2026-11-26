import type { ReactNode } from "react";

import { useId } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type HomeCardProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  icon: UiIconName;
  title: string;
};

export const HOME_CARD_STYLES = {
  padding: "p-3 @2xl/home:p-4 @6xl/home:p-5",
  surface: "rounded-xl border border-border bg-card text-card-foreground shadow-card",
} as const;

export function HomeCard({ action, children, className, icon, title }: HomeCardProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col gap-3",
        HOME_CARD_STYLES.surface,
        HOME_CARD_STYLES.padding,
        className,
      )}
    >
      <header className="flex min-h-8 items-center justify-between gap-3">
        <h2
          className="flex min-w-0 items-center gap-2 font-heading text-lg leading-snug font-semibold text-ink @6xl/home:text-xl"
          id={headingId}
        >
          <UiIcon aria-hidden className="shrink-0 text-primary" name={icon} size={20} />
          <span className="min-w-0 wrap-anywhere">{title}</span>
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}
