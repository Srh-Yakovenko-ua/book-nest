"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { SummaryErrorState } from "@/components/summary-error";

import { SummaryCards } from "@/components/catalog/summary-cards";
import { SummaryDetails } from "@/components/catalog/summary-mobile";
import { SummaryError } from "@/components/summary-error";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

type GenresSummaryProps = {
  cards: SummaryCard[];
  error: Nullable<SummaryErrorState>;
  isLoading: boolean;
};

const GENRES_SUMMARY = {
  cardsCount: 6,
} as const;

export function GenresSummaryCards({ cards, error, isLoading }: GenresSummaryProps) {
  return (
    <SummaryError className="max-sm:hidden" state={error}>
      <SummaryCards cards={cards} isLoading={isLoading} skeletonCount={GENRES_SUMMARY.cardsCount} />
    </SummaryError>
  );
}

export function GenresSummaryPanel({ cards, error, isLoading }: GenresSummaryProps) {
  const t = useTranslations("genres.summary.panel");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />
      <MobilePageOverviewPanel
        closeLabel={t("close")}
        error={
          error === null ? undefined : (
            <SummaryError state={error} variant="embedded">
              {null}
            </SummaryError>
          )
        }
        loading={isLoading}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <SummaryDetails cards={cards} title={t("detailsTitle")} />
      </MobilePageOverviewPanel>
    </>
  );
}
