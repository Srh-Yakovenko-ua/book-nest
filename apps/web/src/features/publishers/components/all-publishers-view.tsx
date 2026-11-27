"use client";

import type { ReactNode, Ref } from "react";

import { useTranslations } from "next-intl";

import { TitleLeaf } from "@/components/title-leaf";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

type AllPublishersViewProps = {
  action: ReactNode;
  content: ReactNode;
  controls: ReactNode;
  insights: ReactNode;
  resultsHeadingRef: Ref<HTMLHeadingElement>;
  summary: ReactNode;
};

export function AllPublishersView({
  action,
  content,
  controls,
  insights,
  resultsHeadingRef,
  summary,
}: AllPublishersViewProps) {
  const t = useTranslations("publishers.page");
  const tInsights = useTranslations("publishers.insights");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
                {t("title")}
              </h1>
              <TitleLeaf />
            </div>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          {action}
        </div>

        {summary}
      </header>

      {controls}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <section
          className={cn("flex min-w-0 flex-1 flex-col gap-6", RETRY_FOCUS_RING.aroundHiddenHeading)}
        >
          <h2 className="sr-only" ref={resultsHeadingRef} tabIndex={-1}>
            {t("resultsTitle")}
          </h2>
          {content}
        </section>

        {insights === null ? null : (
          <aside
            aria-label={tInsights("label")}
            className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
          >
            {insights}
          </aside>
        )}
      </div>
    </div>
  );
}
