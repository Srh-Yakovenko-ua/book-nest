"use client";

import type { ReactNode } from "react";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function StatisticsFocusTarget({
  children,
  className,
  isTarget,
}: {
  children: ReactNode;
  className?: string;
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
      className={cn(
        "scroll-mt-4 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      ref={ref}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
