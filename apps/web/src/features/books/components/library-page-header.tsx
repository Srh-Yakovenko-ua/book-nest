"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import type { SummaryErrorState } from "@/components/summary-error";

import { UiIcon } from "@/components/icons";
import { SummaryError } from "@/components/summary-error";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";

import type { LibrarySummaryCard } from "./library-summary-cards";

import { LibrarySummaryCards } from "./library-summary-cards";

export type LibraryPageHeaderProps = {
  addBookLabel?: string;
  onAddBook?: () => void;
  subtitle: string;
  summaryCards: LibrarySummaryCard[];
  summaryError: Nullable<SummaryErrorState>;
  summaryLoading: boolean;
  summaryMobileAction?: ReactNode;
  summaryMobileCards?: LibrarySummaryCard[];
  summaryMobileLayout?: "compact" | "grid";
  title: string;
};

export function LibraryPageHeader({
  addBookLabel,
  onAddBook,
  subtitle,
  summaryCards,
  summaryError,
  summaryLoading,
  summaryMobileAction,
  summaryMobileCards,
  summaryMobileLayout,
  title,
}: LibraryPageHeaderProps) {
  return (
    <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
              {title}
            </h1>
            <TitleLeaf />
          </div>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {onAddBook && addBookLabel ? (
          <Button className="self-start sm:self-auto" onClick={onAddBook}>
            <UiIcon name="plus" size={16} />
            {addBookLabel}
          </Button>
        ) : null}
      </div>

      <SummaryError state={summaryError}>
        <LibrarySummaryCards
          cards={summaryCards}
          isLoading={summaryLoading}
          mobileAction={summaryMobileAction}
          mobileCards={summaryMobileCards}
          mobileLayout={summaryMobileLayout}
        />
      </SummaryError>
    </header>
  );
}
