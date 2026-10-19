"use client";

import type { ReactNode } from "react";

import { useEffect, useRef } from "react";

export function StatisticsFocusTarget({
  children,
  isTarget,
}: {
  children: ReactNode;
  isTarget: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isTarget) return;
    ref.current?.scrollIntoView({ block: "start" });
    ref.current?.focus({ preventScroll: true });
  }, [isTarget]);

  return (
    <div
      className="scroll-mt-4 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      ref={ref}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
