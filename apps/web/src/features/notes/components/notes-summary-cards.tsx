"use client";

import type { ReactNode } from "react";

import type { SummaryCard } from "@/components/catalog/summary-cards";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { SummaryError } from "@/components/summary-error";

type NotesSummaryCardsProps = {
  cards: SummaryCard[];
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
        <SummaryCards
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
