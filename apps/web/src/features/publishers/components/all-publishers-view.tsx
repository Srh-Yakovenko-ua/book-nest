"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";

type AllPublishersViewProps = {
  banner: ReactNode;
  content: ReactNode;
  onAddBook: () => void;
  pagination: ReactNode;
  showChrome: boolean;
  summary: ReactNode;
  toolbar: ReactNode;
};

export function AllPublishersView({
  banner,
  content,
  onAddBook,
  pagination,
  showChrome,
  summary,
  toolbar,
}: AllPublishersViewProps) {
  const t = useTranslations("publishers.page");

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
          <Button className="self-start sm:self-auto" onClick={onAddBook}>
            <UiIcon name="plus" size={16} />
            {t("addBook")}
          </Button>
        </div>

        {summary}
      </header>

      {showChrome ? toolbar : null}

      <div className="flex flex-col gap-6">
        <h2 className="sr-only">{t("resultsTitle")}</h2>
        {content}
        {pagination}
      </div>

      {banner}
    </div>
  );
}
