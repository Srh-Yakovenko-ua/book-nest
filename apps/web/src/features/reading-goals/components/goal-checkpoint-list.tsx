"use client";

import type { ReadingGoalCheckpoint } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { assertNever } from "@/lib/assert-never";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { GoalCheckpointState, GoalCheckpointSummary } from "../model/goal-checkpoint-state";

import {
  resolveGoalCheckpointState,
  summarizeGoalCheckpointStates,
} from "../model/goal-checkpoint-state";
import { GoalOverviewCard } from "./goal-overview-card";

type CheckpointItemProps = {
  checkpoint: ReadingGoalCheckpoint;
  position: number;
  state: GoalCheckpointState;
};

type GoalCheckpointListProps = {
  checkpoints: ReadingGoalCheckpoint[];
};

const CHECKPOINT_LOOK = {
  achieved: {
    badge: "success",
    icon: "check",
    marker: "border-success bg-success-soft text-success",
    reached: true,
  },
  achieved_late: {
    badge: "warning",
    icon: "check",
    marker: "border-warning bg-warning-soft text-warning",
    reached: true,
  },
  missed: {
    badge: "destructive",
    icon: "alert-circle",
    marker: "border-error bg-error-soft text-error",
    reached: false,
  },
  upcoming: {
    badge: "secondary",
    icon: "clock",
    marker: "border-border bg-card text-muted-foreground",
    reached: false,
  },
} as const satisfies Record<
  GoalCheckpointState["kind"],
  {
    badge: "destructive" | "secondary" | "success" | "warning";
    icon: UiIconName;
    marker: string;
    reached: boolean;
  }
>;

export function GoalCheckpointList({ checkpoints }: GoalCheckpointListProps) {
  const t = useTranslations("goals.detail.overview.checkpoints");

  if (checkpoints.length === 0) return null;

  const entries = checkpoints.map((checkpoint) => ({
    checkpoint,
    state: resolveGoalCheckpointState(checkpoint),
  }));
  const summary = summarizeGoalCheckpointStates(entries.map(({ state }) => state));

  return (
    <GoalOverviewCard
      aside={<CheckpointSummary summary={summary} />}
      icon="timeline"
      title={t("title")}
    >
      <ol className="flex flex-col lg:flex-row">
        {entries.map(({ checkpoint, state }, index) => (
          <CheckpointItem
            checkpoint={checkpoint}
            key={`${checkpoint.dueDate}-${checkpoint.targetCount}`}
            position={index + 1}
            state={state}
          />
        ))}
      </ol>
    </GoalOverviewCard>
  );
}

function CheckpointItem({ checkpoint, position, state }: CheckpointItemProps) {
  const t = useTranslations("goals.detail.overview.checkpoints");
  const tStatus = useTranslations("goals.detail.overview.checkpoints.status");
  const locale = useLocale();
  const look = CHECKPOINT_LOOK[state.kind];

  function note(): string {
    switch (state.kind) {
      case "achieved":
        return t("achievedOn", { date: formatDateLong(state.achievedAt, locale) });
      case "achieved_late":
        return t("achievedLate", {
          count: state.lateDays,
          date: formatDateLong(state.achievedAt, locale),
        });
      case "missed":
      case "upcoming":
        return t("current", {
          current: checkpoint.currentCompletedCount,
          target: checkpoint.targetCount,
        });
      default:
        return assertNever(state);
    }
  }

  return (
    <li className="group/checkpoint relative flex gap-3 pb-5 last:pb-0 lg:min-w-0 lg:flex-1 lg:flex-col lg:items-center lg:gap-2 lg:pb-0 lg:text-center">
      <span
        aria-hidden
        className={cn(
          "absolute top-8 bottom-0 left-4 w-px -translate-x-1/2 group-last/checkpoint:hidden lg:top-4 lg:bottom-auto lg:left-1/2 lg:h-px lg:w-full lg:translate-x-0",
          look.reached ? "bg-primary/60" : "bg-border",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "relative grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
          look.marker,
        )}
      >
        {state.kind === "upcoming" ? position : <UiIcon name={look.icon} size={14} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1 lg:items-center lg:px-1">
        <p className="text-sm font-semibold text-ink">
          {t("count", { count: checkpoint.targetCount })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("due", { date: formatDateLong(checkpoint.dueDate, locale) })}
        </p>
        <Badge
          className="mt-1 h-auto min-h-6 gap-1.5 px-2.5 text-center whitespace-normal"
          variant={look.badge}
        >
          <UiIcon name={look.icon} size={12} />
          {tStatus(state.kind)}
        </Badge>
        <p className="text-xs text-muted-foreground tabular-nums">{note()}</p>
      </div>
    </li>
  );
}

function CheckpointSummary({ summary }: { summary: GoalCheckpointSummary }) {
  const t = useTranslations("goals.detail.overview.checkpoints");
  const { late, reached, total } = summary;

  return (
    <p className="text-xs font-medium text-muted-foreground tabular-nums">
      {late === 0
        ? t("summary", { reached, total })
        : t("summaryWithLate", { late, reached, total })}
    </p>
  );
}
