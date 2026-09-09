"use client";

import type { Nullable } from "@app/shared";

import { useEffect, useState } from "react";

export type StoreHighlight = {
  activeStoreKey: Nullable<string>;
  hover: (storeKey: Nullable<string>) => void;
  select: (storeKey: string) => void;
  selectedStoreKey: Nullable<string>;
};

export function useStoreHighlight(): StoreHighlight {
  const [hoveredStoreKey, setHoveredStoreKey] = useState<Nullable<string>>(null);
  const [selectedStoreKey, setSelectedStoreKey] = useState<Nullable<string>>(null);

  useEffect(() => {
    if (selectedStoreKey === null) return;

    function clearSelectionOnEscape(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") setSelectedStoreKey(null);
    }

    window.addEventListener("keydown", clearSelectionOnEscape);
    return () => window.removeEventListener("keydown", clearSelectionOnEscape);
  }, [selectedStoreKey]);

  return {
    activeStoreKey: hoveredStoreKey ?? selectedStoreKey,
    hover: setHoveredStoreKey,
    select: (storeKey: string) =>
      setSelectedStoreKey((current) => (current === storeKey ? null : storeKey)),
    selectedStoreKey,
  };
}
