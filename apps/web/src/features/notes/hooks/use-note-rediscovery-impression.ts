"use client";

import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { useEffect, useEffectEvent, useRef } from "react";

import { useRecordNoteRediscoveryImpression } from "../api/use-notes-overview-mutations";

export type RecordNoteImpression = (impressionKey: string) => void;

const VISIBLE_IMPRESSION = {
  threshold: 0.5,
} as const;

export function useNoteRediscoveryImpressions(): RecordNoteImpression {
  const { mutateAsync } = useRecordNoteRediscoveryImpression();
  const recordedKeys = useRef(new Set<string>());

  return (impressionKey) => {
    if (recordedKeys.current.has(impressionKey)) return;

    recordedKeys.current.add(impressionKey);
    void mutateAsync({ impressionKey }).catch(() => {
      recordedKeys.current.delete(impressionKey);
    });
  };
}

export function useRecordImpressionWhenVisible<TElement extends Element>({
  impressionKey,
  recordImpression,
}: {
  impressionKey: string;
  recordImpression: RecordNoteImpression;
}): RefObject<Nullable<TElement>> {
  const ref = useRef<Nullable<TElement>>(null);
  const recordVisibleImpression = useEffectEvent(() => recordImpression(impressionKey));

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    if (typeof IntersectionObserver === "undefined") {
      recordVisibleImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        observer.disconnect();
        recordVisibleImpression();
      },
      { threshold: VISIBLE_IMPRESSION.threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [impressionKey]);

  return ref;
}
