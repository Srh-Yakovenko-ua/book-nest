"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { useGoalCreationPreview } from "../api/use-goal-creation-preview";
import { reachesTargetOnCreation } from "../model/goal-form";

type GoalCreationPreviewProps = {
  children: ReactNode;
  deadline: string;
  listId: string;
  targetCount: number;
  today: string;
};

export function GoalCreationPreview({
  children,
  deadline,
  listId,
  targetCount,
  today,
}: GoalCreationPreviewProps) {
  const t = useTranslations("goals.form.preview");
  const preview = useGoalCreationPreview({ deadline, listId, today });
  const countedCount = preview.isSuccess ? preview.data.countedCount : 0;

  return (
    <div className="text-xs leading-relaxed">
      <div role="status">
        {countedCount > 0 ? (
          <p className="mb-2 font-medium text-foreground">
            {t("counted", { count: countedCount })}
            {reachesTargetOnCreation({ countedCount, targetCount }) ? (
              <>
                {" "}
                <span className="text-success">{t("completesNow")}</span>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
