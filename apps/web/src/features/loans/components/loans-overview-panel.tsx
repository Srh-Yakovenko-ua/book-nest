"use client";

import type { LoanListItemView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import type { LoanDirection } from "../model/loan-pages";
import type { LoansAttention, LoansPeople } from "./loans-sidebar";

import { LoansSidebarSections } from "./loans-sidebar";

type LoansOverviewPanelProps = {
  attention: Nullable<LoansAttention>;
  direction: LoanDirection;
  isLoading: boolean;
  longHeldLoans: LoanListItemView[];
  people: LoansPeople;
  summaryCards: SummaryCard[];
  upcomingReturns: LoanListItemView[];
};

export function LoansOverviewPanel({
  attention,
  direction,
  isLoading,
  longHeldLoans,
  people,
  summaryCards,
  upcomingReturns,
}: LoansOverviewPanelProps) {
  const t = useTranslations("loans.overviewPanel");
  const tDetails = useTranslations("loans.summary.mobile");
  const panel = useMobilePageOverviewPanel();

  const tabs: MobilePageOverviewTab[] = [
    {
      content: <SummaryDetails cards={summaryCards} title={tDetails("title")} />,
      id: "overview",
      label: t("tabs.overview"),
    },
    {
      content: (
        <div className="flex flex-col gap-4">
          <LoansSidebarSections
            attention={
              attention === null
                ? null
                : {
                    ...attention,
                    onSelect: (key) => panel.closeThen(() => attention.onSelect(key)),
                  }
            }
            direction={direction}
            isLoading={isLoading}
            longHeldLoans={longHeldLoans}
            people={{
              ...people,
              onPersonOpen: (contactId) => panel.closeThen(() => people.onPersonOpen(contactId)),
              onPersonSelect: (personName) =>
                panel.closeThen(() => people.onPersonSelect(personName)),
            }}
            upcomingReturns={upcomingReturns}
          />
        </div>
      ),
      id: "schedule",
      label: t("tabs.schedule"),
    },
  ];

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        panel={panel}
        subtitle={t("subtitle")}
        tabs={tabs}
        title={t("title")}
      />
    </>
  );
}
