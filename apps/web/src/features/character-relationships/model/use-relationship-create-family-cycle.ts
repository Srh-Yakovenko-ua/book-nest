"use client";

import type { Nullable } from "@app/shared";

import { useState } from "react";

type FamilyCycleWarning = {
  overridable: boolean;
};

export function useRelationshipCreateFamilyCycle(semanticKey: string) {
  const [warning, setWarning] = useState<Nullable<FamilyCycleWarning>>(null);
  const [observedSemanticKey, setObservedSemanticKey] = useState(semanticKey);

  if (observedSemanticKey !== semanticKey) {
    setObservedSemanticKey(semanticKey);
    setWarning(null);
  }

  return {
    clear: () => setWarning(null),
    report: (overridable: boolean) => setWarning({ overridable }),
    warning,
  };
}
