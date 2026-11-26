"use client";

import type { ReadingGoalDetail, ReadingGoalRiskReason } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { GOAL_SIGNAL_TONE } from "../model/goal-status";
import { GoalOverviewCard } from "./goal-overview-card";

type GoalRiskReasonItemProps = {
  goal: ReadingGoalDetail;
  reason: ReadingGoalRiskReason;
};

type GoalStateCardProps = {
  goal: ReadingGoalDetail;
  onShowRemainingBooks: () => void;
};

export function GoalStateCard({ goal, onShowRemainingBooks }: GoalStateCardProps) {
  const t = useTranslations("goals.detail.overview.risk");
  const tRisk = useTranslations("goals.risk");
  const { riskLevel, riskReasons } = goal;
  const hasRiskSignals = riskLevel !== "none" || riskReasons.length > 0;

  if (!hasRiskSignals && goal.status !== "active") return null;

  if (!hasRiskSignals) {
    return (
      <GoalOverviewCard className="md:self-start" icon="check-circle" title={t("title")}>
        <p className="text-sm text-muted-foreground">{t("none")}</p>
      </GoalOverviewCard>
    );
  }

  return (
    <GoalOverviewCard icon="alert-triangle" title={t("title")}>
      {riskLevel === "none" ? null : (
        <Badge className="h-6 gap-1.5 px-2.5" variant={GOAL_SIGNAL_TONE.risk[riskLevel]}>
          <UiIcon name="alert-triangle" size={12} />
          {tRisk(riskLevel)}
        </Badge>
      )}
      {riskReasons.length === 0 ? null : (
        <ul className="flex flex-col gap-2">
          {riskReasons.map((reason) => (
            <GoalRiskReasonItem goal={goal} key={reason} reason={reason} />
          ))}
        </ul>
      )}
      {riskLevel !== "none" && goal.status === "active" ? (
        <GoalNextStep goal={goal} onShowRemainingBooks={onShowRemainingBooks} />
      ) : null}
    </GoalOverviewCard>
  );
}

function GoalNextStep({ goal, onShowRemainingBooks }: GoalStateCardProps) {
  const t = useTranslations("goals.detail.overview.risk");
  const { requiredDaysPerBook } = goal;
  const hasRequiredRate = requiredDaysPerBook !== null && requiredDaysPerBook > 0;

  return (
    <div className="flex items-start gap-3 rounded-lg bg-accent/40 p-3">
      <UiIcon className="mt-0.5 shrink-0 text-icon" name="bulb" size={18} />
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <p className="text-sm font-medium text-ink">{t("nextStep")}</p>
        {hasRequiredRate ? (
          <p className="text-sm text-foreground">
            {t("requiredRate", { count: requiredDaysPerBook })}
          </p>
        ) : (
          <Button onClick={onShowRemainingBooks} size="sm" variant="secondary">
            {t("showRemaining")}
            <UiIcon name="arrow-right" size={14} />
          </Button>
        )}
      </div>
    </div>
  );
}

function GoalRiskReasonItem({ goal, reason }: GoalRiskReasonItemProps) {
  const t = useTranslations("goals.detail.overview.risk");
  const tReason = useTranslations("goals.detail.overview.risk.reasons");
  const { pace, projectedDaysDelta } = goal;

  function reasonText(): string {
    if (reason !== "projected_late") return tReason(reason);
    if (projectedDaysDelta === null || projectedDaysDelta >= 0) return t("projectedLateUnknown");
    return tReason("projected_late", { count: Math.abs(projectedDaysDelta) });
  }

  return (
    <li className="flex items-start gap-2 text-sm text-foreground">
      <UiIcon className="mt-0.5 shrink-0 text-warning" name="alert-circle" size={16} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span>{reasonText()}</span>
        {reason === "projected_late" && pace === "on_track" ? (
          <span className="text-xs text-muted-foreground">{t("onTrackProjectedLate")}</span>
        ) : null}
      </div>
    </li>
  );
}
