"use client";

import { useRef } from "react";

import { useRecordRediscoveryImpression } from "@/features/quotes";

export function useQuoteMemoryImpressions(): (quoteId: string) => void {
  const { mutateAsync } = useRecordRediscoveryImpression();
  const recordedQuoteIds = useRef(new Set<string>());

  return (quoteId) => {
    if (recordedQuoteIds.current.has(quoteId)) return;

    recordedQuoteIds.current.add(quoteId);
    void mutateAsync({ quoteId }).catch(() => {
      recordedQuoteIds.current.delete(quoteId);
    });
  };
}
