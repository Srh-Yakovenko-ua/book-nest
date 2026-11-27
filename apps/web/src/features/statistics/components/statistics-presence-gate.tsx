"use client";

import type { ReadingStatisticsOverview } from "@app/shared";
import type { ReactNode, Ref } from "react";

import { useRef } from "react";

import { useRetryFocus } from "@/hooks/use-retry-focus";
import { assertNever } from "@/lib/assert-never";
import { RETRY_FOCUS_RING } from "@/lib/retry-focus-ring";
import { cn } from "@/lib/utils";

import type {
  StatisticsPresenceSignal,
  StatisticsReadingPresence,
} from "../model/statistics-reading-presence";

import { useStatisticsReadingPresence } from "../hooks/use-statistics-reading-presence";
import { hasStatisticsPresence } from "../model/statistics-reading-presence";
import { StatisticsError, StatisticsSkeleton } from "./statistics-states";

export type StatisticsAbsentPresence = Extract<
  StatisticsReadingPresence,
  { kind: "no_activity" | "period_empty" }
>;

type StatisticsPresenceGateProps = {
  children: ReactNode;
  overview: ReadingStatisticsOverview;
  renderAbsent: (presence: StatisticsAbsentPresence) => ReactNode;
  signal: StatisticsPresenceSignal;
};

export function StatisticsPresenceGate({
  children,
  overview,
  renderAbsent,
  signal,
}: StatisticsPresenceGateProps) {
  if (hasStatisticsPresence({ overview, signal })) return children;

  return (
    <ResolvedStatisticsPresence overview={overview} renderAbsent={renderAbsent} signal={signal}>
      {children}
    </ResolvedStatisticsPresence>
  );
}

function ResolvedStatisticsPresence({
  children,
  overview,
  renderAbsent,
  signal,
}: StatisticsPresenceGateProps) {
  const presence = useStatisticsReadingPresence({ selected: overview, signal });
  const presenceRef = useRef<HTMLDivElement>(null);
  const { retryButtonRef, withRetryFocus } = useRetryFocus(presenceRef);

  return (
    <div
      className={cn("flex flex-col gap-6", RETRY_FOCUS_RING.onTarget)}
      ref={presenceRef}
      tabIndex={-1}
    >
      <StatisticsPresenceState
        presence={presence}
        renderAbsent={renderAbsent}
        retryButtonRef={retryButtonRef}
        withRetryFocus={withRetryFocus}
      >
        {children}
      </StatisticsPresenceState>
    </div>
  );
}

function StatisticsPresenceState({
  children,
  presence,
  renderAbsent,
  retryButtonRef,
  withRetryFocus,
}: {
  children: ReactNode;
  presence: StatisticsReadingPresence;
  renderAbsent: (presence: StatisticsAbsentPresence) => ReactNode;
  retryButtonRef: Ref<HTMLButtonElement>;
  withRetryFocus: (onRetry: () => void) => () => void;
}) {
  switch (presence.kind) {
    case "error":
      return (
        <StatisticsError onRetry={withRetryFocus(presence.retry)} retryButtonRef={retryButtonRef} />
      );
    case "has_activity":
      return children;
    case "no_activity":
    case "period_empty":
      return renderAbsent(presence);
    case "pending":
      return <StatisticsSkeleton />;
    default:
      return assertNever(presence);
  }
}
