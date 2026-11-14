"use client";

import type { ReactNode } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { SummaryError } from "@/components/summary-error";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type NotesSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction: ReactNode;
  onRetry: () => void;
};

export function NotesSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
  onRetry,
}: NotesSummaryCardsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <SummaryError state={isError ? { onRetry } : null}>
        <LibrarySummaryCards
          cards={cards}
          isLoading={isLoading}
          mobileAction={mobileAction}
          mobileLayout="compact"
        />
      </SummaryError>
      {isError ? <div className="empty:hidden sm:hidden">{mobileAction}</div> : null}
    </div>
  );
}
