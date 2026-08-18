"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useRef, useState } from "react";

export const REVEAL_SHIPMENT = {
  highlightMs: 2400,
} as const;

export type RevealShipment = {
  request: (shipmentId: string) => void;
  revealedShipmentId: Nullable<string>;
};

export function useRevealShipment({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  loadedShipmentIds,
}: {
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadedShipmentIds: readonly string[];
}): RevealShipment {
  const [pendingShipmentId, setPendingShipmentId] = useState<Nullable<string>>(null);
  const [revealedShipmentId, setRevealedShipmentId] = useState<Nullable<string>>(null);
  const highlightTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);

  const isPendingLoaded =
    pendingShipmentId !== null && loadedShipmentIds.includes(pendingShipmentId);

  useEffect(() => {
    if (pendingShipmentId === null) return;

    if (!isPendingLoaded) {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      else if (!hasNextPage) setPendingShipmentId(null);
      return;
    }

    setPendingShipmentId(null);
    setRevealedShipmentId(pendingShipmentId);
    scrollToShipment(pendingShipmentId);

    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(
      () => setRevealedShipmentId(null),
      REVEAL_SHIPMENT.highlightMs,
    );
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isPendingLoaded, pendingShipmentId]);

  useEffect(
    () => () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    },
    [],
  );

  return {
    request: (shipmentId) => {
      setRevealedShipmentId(null);
      setPendingShipmentId(shipmentId);
    },
    revealedShipmentId,
  };
}

function scrollToShipment(shipmentId: string): void {
  const target = document.querySelector(`[data-shipment-id="${shipmentId}"]`);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}
