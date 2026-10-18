"use client";

import type { ReadingGoalDetail } from "@app/shared";

import { useTranslations } from "next-intl";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { assertNever } from "@/lib/assert-never";

import type { UseGoalDetailQueryResult } from "../model/use-goal-detail-query";

import { GOAL_DETAIL_QUERY, toGoalDetailTab } from "../model/goal-detail-query";
import { useGoalDetailQuery } from "../model/use-goal-detail-query";
import { GoalActivityTab } from "./goal-activity-tab";
import { GoalBooksTab } from "./goal-books-tab";
import { GoalDetailActions } from "./goal-detail-actions";
import { GoalDetailHeader } from "./goal-detail-header";
import { GoalOverviewTab } from "./goal-overview-tab";

type GoalDetailSectionContentProps = {
  goal: ReadingGoalDetail;
  query: UseGoalDetailQueryResult;
};

type GoalDetailsViewProps = {
  goal: ReadingGoalDetail;
};

export function GoalDetailsView({ goal }: GoalDetailsViewProps) {
  const t = useTranslations("goals.detail.tabs");
  const query = useGoalDetailQuery();
  const tabs: PageTabsItem[] = GOAL_DETAIL_QUERY.tabOptions.map((tab) => ({
    label: t(tab),
    value: tab,
  }));

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
      <GoalDetailHeader actions={<GoalDetailActions goal={goal} />} goal={goal} />

      <PageTabs
        ariaLabel={t("label")}
        items={tabs}
        onValueChange={(value) => query.setTab(toGoalDetailTab(value))}
        value={query.section.tab}
      >
        <PageTabsPanel value={query.section.tab}>
          <GoalDetailSectionContent goal={goal} query={query} />
        </PageTabsPanel>
      </PageTabs>
    </div>
  );
}

function GoalDetailSectionContent({ goal, query }: GoalDetailSectionContentProps) {
  const { section } = query;

  switch (section.tab) {
    case "activity":
      return (
        <GoalActivityTab
          activityType={section.activityType}
          goalId={goal.id}
          onActivityTypeChange={query.setActivityType}
        />
      );
    case "books":
      return <GoalBooksTab goalId={goal.id} onScopeChange={query.setScope} scope={section.scope} />;
    case "overview":
      return <GoalOverviewTab goal={goal} onShowActivity={() => query.setTab("activity")} />;
    default:
      return assertNever(section);
  }
}
