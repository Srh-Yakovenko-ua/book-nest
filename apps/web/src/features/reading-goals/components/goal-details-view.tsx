"use client";

import type { Nullable, ReadingGoalDetail } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { PageTabsItem } from "@/components/page-tabs";

import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { assertNever } from "@/lib/assert-never";

import type { GoalDetailTab } from "../model/goal-detail-query";
import type { UseGoalDetailQueryResult } from "../model/use-goal-detail-query";

import { goalBooksScopeCounts } from "../model/goal-books-scope-counts";
import { GOAL_DETAIL_QUERY, toGoalDetailTab } from "../model/goal-detail-query";
import { useGoalDetailQuery } from "../model/use-goal-detail-query";
import { GoalActivityTab } from "./goal-activity-tab";
import { GoalBooksTab } from "./goal-books-tab";
import { GoalDetailActions } from "./goal-detail-actions";
import { GoalDetailHeader } from "./goal-detail-header";
import { GoalOverviewTab } from "./goal-overview-tab";
import { GoalProgressHero } from "./goal-progress-hero";

type GoalDetailSectionContentProps = {
  goal: ReadingGoalDetail;
  listFocus: Nullable<GoalListFocusRequest>;
  onShowRemainingBooks: () => void;
  query: UseGoalDetailQueryResult;
  requestListFocus: (tab: GoalDetailTab) => void;
};

type GoalDetailsViewProps = {
  goal: ReadingGoalDetail;
};

type GoalListFocusRequest = {
  serial: number;
  tab: GoalDetailTab;
};

export function GoalDetailsView({ goal }: GoalDetailsViewProps) {
  const t = useTranslations("goals.detail.tabs");
  const query = useGoalDetailQuery();
  const [listFocus, setListFocus] = useState<Nullable<GoalListFocusRequest>>(null);
  const tabs: PageTabsItem[] = GOAL_DETAIL_QUERY.tabOptions.map((tab) => ({
    label: t(tab),
    value: tab,
  }));

  function requestListFocus(tab: GoalDetailTab) {
    setListFocus((current) => ({ serial: (current?.serial ?? 0) + 1, tab }));
  }

  function showRemainingBooks() {
    requestListFocus("books");
    query.setTab("books");
    query.setScope("remaining");
  }

  return (
    <div className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 sm:gap-6">
      <GoalDetailHeader actions={<GoalDetailActions goal={goal} />} goal={goal} />
      <GoalProgressHero goal={goal} onShowRemainingBooks={showRemainingBooks} />

      <PageTabs
        ariaLabel={t("label")}
        items={tabs}
        onValueChange={(value) => {
          setListFocus(null);
          query.setTab(toGoalDetailTab(value));
        }}
        value={query.section.tab}
      >
        <PageTabsPanel value={query.section.tab}>
          <GoalDetailSectionContent
            goal={goal}
            listFocus={listFocus}
            onShowRemainingBooks={showRemainingBooks}
            query={query}
            requestListFocus={requestListFocus}
          />
        </PageTabsPanel>
      </PageTabs>
    </div>
  );
}

function GoalDetailSectionContent({
  goal,
  listFocus,
  onShowRemainingBooks,
  query,
  requestListFocus,
}: GoalDetailSectionContentProps) {
  const { section } = query;

  switch (section.tab) {
    case "activity":
      return (
        <GoalActivityTab
          activityType={section.activityType}
          focusListOnMount={listFocus?.tab === "activity"}
          goalId={goal.id}
          onActivityTypeChange={query.setActivityType}
        />
      );
    case "books":
      return (
        <GoalBooksTab
          counts={goalBooksScopeCounts(goal)}
          goalId={goal.id}
          listFocusRequest={listFocus?.tab === "books" ? listFocus.serial : null}
          onScopeChange={query.setScope}
          scope={section.scope}
        />
      );
    case "overview":
      return (
        <GoalOverviewTab
          goal={goal}
          onShowActivity={() => {
            requestListFocus("activity");
            query.setTab("activity");
          }}
          onShowRemainingBooks={onShowRemainingBooks}
        />
      );
    default:
      return assertNever(section);
  }
}
