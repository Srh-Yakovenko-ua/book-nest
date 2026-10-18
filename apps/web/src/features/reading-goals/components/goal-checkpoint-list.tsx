"use client";

import type { ReadingGoalCheckpoint, ReadingGoalCheckpointStatus } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { formatDateLong } from "@/lib/format";

type GoalCheckpointListProps = {
  checkpoints: ReadingGoalCheckpoint[];
};

const CHECKPOINT_BADGE = {
  achieved: { icon: "check-circle", tone: "success" },
  missed: { icon: "alert-circle", tone: "warning" },
  upcoming: { icon: "clock", tone: "secondary" },
} as const satisfies Record<
  ReadingGoalCheckpointStatus,
  { icon: UiIconName; tone: "secondary" | "success" | "warning" }
>;

export function GoalCheckpointList({ checkpoints }: GoalCheckpointListProps) {
  const t = useTranslations("goals.detail.overview.checkpoints");

  if (checkpoints.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
      <ol className="flex flex-col gap-2">
        {checkpoints.map((checkpoint) => (
          <CheckpointRow
            checkpoint={checkpoint}
            key={`${checkpoint.dueDate}-${checkpoint.targetCount}`}
          />
        ))}
      </ol>
    </section>
  );
}

function CheckpointRow({ checkpoint }: { checkpoint: ReadingGoalCheckpoint }) {
  const t = useTranslations("goals.detail.overview.checkpoints");
  const tStatus = useTranslations("goals.detail.overview.checkpoints.status");
  const locale = useLocale();
  const badge = CHECKPOINT_BADGE[checkpoint.status];

  function note(): string {
    if (checkpoint.achievedAt !== null) {
      const date = formatDateLong(checkpoint.achievedAt, locale);
      return checkpoint.status === "missed"
        ? t("achievedLate", { date })
        : t("achievedOn", { date });
    }
    return t("current", {
      current: checkpoint.currentCompletedCount,
      target: checkpoint.targetCount,
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-ink">
          {t("target", {
            count: checkpoint.targetCount,
            date: formatDateLong(checkpoint.dueDate, locale),
          })}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">{note()}</p>
      </div>
      <Badge className="h-6 w-fit shrink-0 gap-1.5 px-2.5" variant={badge.tone}>
        <UiIcon aria-hidden name={badge.icon} size={12} />
        {tStatus(checkpoint.status)}
      </Badge>
    </li>
  );
}
