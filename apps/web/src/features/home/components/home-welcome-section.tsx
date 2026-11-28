"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useId } from "react";

import type { HomeGreetingTone, HomeSubtitleKey } from "../model/home-greeting";

type HomeWelcomeSectionProps = {
  action: Nullable<ReactNode>;
  displayName: Nullable<string>;
  greetingTone: HomeGreetingTone;
  illustration: Nullable<ReactNode>;
  subtitle: HomeSubtitleKey;
  summary: ReactNode;
};

export function HomeWelcomeSection({
  action,
  displayName,
  greetingTone,
  illustration,
  subtitle,
  summary,
}: HomeWelcomeSectionProps) {
  const t = useTranslations("home");
  const headingId = useId();

  const greeting =
    displayName === null
      ? t(`greeting.anonymous.${greetingTone}`)
      : t(`greeting.named.${greetingTone}`, { name: displayName });

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 @3xl/home:flex-row @3xl/home:items-end @3xl/home:justify-between @3xl/home:gap-6"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 @3xl/home:gap-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            className="font-display text-2xl leading-tight font-semibold wrap-anywhere text-ink @3xl/home:text-4xl"
            id={headingId}
          >
            {greeting}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground @3xl/home:text-base">
            {t(`subtitle.${subtitle}`)}
          </p>
        </div>
        {summary}
      </div>

      <div className="flex shrink-0 flex-col gap-3 @3xl/home:items-end">
        {illustration}
        {action}
      </div>
    </section>
  );
}
