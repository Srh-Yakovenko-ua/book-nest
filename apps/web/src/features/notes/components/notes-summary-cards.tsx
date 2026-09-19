"use client";

import type { ReactNode } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

type NotesSummaryCardsProps = {
  cards: LibrarySummaryCard[];
  isError: boolean;
  isLoading: boolean;
  mobileAction: ReactNode;
};

export function NotesSummaryCards({
  cards,
  isError,
  isLoading,
  mobileAction,
}: NotesSummaryCardsProps) {
  if (isError) return <div className="empty:hidden sm:hidden">{mobileAction}</div>;

  return (
    <LibrarySummaryCards
      cards={cards}
      isLoading={isLoading}
      mobileAction={mobileAction}
      mobileLayout="compact"
    />
  );
}
