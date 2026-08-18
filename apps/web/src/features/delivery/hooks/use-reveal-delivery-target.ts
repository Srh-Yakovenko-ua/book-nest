"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useRef, useState } from "react";

export type DeliveryRevealTarget = {
  id: string;
  kind: "order" | "shipment";
};

export type RevealDeliveryTarget = {
  request: (target: DeliveryRevealTarget) => void;
  revealed: Nullable<DeliveryRevealTarget>;
};

const REVEAL_DELIVERY_TARGET = {
  highlightMs: 2400,
} as const;

export function useRevealDeliveryTarget({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  isShowingPreviousList,
  loadedOrderIds,
  loadedShipmentIds,
}: {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isShowingPreviousList: boolean;
  loadedOrderIds: readonly string[];
  loadedShipmentIds: readonly string[];
}): RevealDeliveryTarget {
  const [pendingTarget, setPendingTarget] = useState<Nullable<DeliveryRevealTarget>>(null);
  const [revealed, setRevealed] = useState<Nullable<DeliveryRevealTarget>>(null);
  const highlightTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);

  const isPendingLoaded =
    pendingTarget !== null &&
    (pendingTarget.kind === "order" ? loadedOrderIds : loadedShipmentIds).includes(
      pendingTarget.id,
    );

  useEffect(() => {
    if (pendingTarget === null) return;

    if (!isPendingLoaded) {
      if (isShowingPreviousList) return;
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      else if (!hasNextPage) setPendingTarget(null);
      return;
    }

    setPendingTarget(null);
    setRevealed(pendingTarget);
    scrollToTarget(pendingTarget);

    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(
      () => setRevealed(null),
      REVEAL_DELIVERY_TARGET.highlightMs,
    );
  }, [
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPendingLoaded,
    isShowingPreviousList,
    pendingTarget,
  ]);

  useEffect(
    () => () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    },
    [],
  );

  return {
    request: (target) => {
      setRevealed(null);
      setPendingTarget(target);
    },
    revealed,
  };
}

function scrollToTarget({ id, kind }: DeliveryRevealTarget): void {
  const selector = kind === "order" ? `[data-order-id="${id}"]` : `[data-shipment-id="${id}"]`;
  document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "center" });
}
