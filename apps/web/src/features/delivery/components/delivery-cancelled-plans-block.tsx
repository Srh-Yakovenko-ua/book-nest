"use client";

import type { CancelledFollowUpView, Nullable, ReadingGoalRiskLevel } from "@app/shared";

import { useTranslations } from "next-intl";

import { LibraryOverviewSection } from "@/features/books/components/library-overview-blocks";

import { buildCancelledPlanRows } from "../model/cancelled-follow-up";
import { DeliveryBookMetaLink } from "./delivery-book-preview";

type DeliveryCancelledPlansBlockProps = {
  plans: Nullable<CancelledFollowUpView["plans"]>;
};

const RISK_LABEL_KEY = {
  critical: "context.risk.critical",
  high: "context.risk.high",
} as const satisfies Partial<Record<ReadingGoalRiskLevel, string>>;

export function DeliveryCancelledPlansBlock({ plans }: DeliveryCancelledPlansBlockProps) {
  const t = useTranslations("delivery.history.cancelledPlans");

  if (plans === null) {
    return null;
  }

  const rows = buildCancelledPlanRows({
    books: plans.books,
    labels: {
      goalNamed: (name) => t("context.goalNamed", { name }),
      goalsCount: (count) => t("context.goalsCount", { count }),
      goalUnnamed: t("context.goalUnnamed"),
      queue: t("context.queue"),
      risk: (level) => (isShownRisk(level) ? t(RISK_LABEL_KEY[level]) : null),
      seriesNext: t("context.seriesNext"),
    },
  });
  const hiddenCount = plans.booksCount - rows.length;

  return (
    <LibraryOverviewSection className="sidebar-card-leaf" title={t("title")}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-heading text-lg leading-tight font-semibold text-ink">
            {t("booksCount", { count: plans.booksCount })}
          </p>
          <p className="text-xs text-muted-foreground">{t("helper")}</p>
        </div>

        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <DeliveryBookMetaLink
                book={row}
                meta={
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {row.contextText}
                  </span>
                }
              />
            </li>
          ))}
        </ul>

        {hiddenCount > 0 ? (
          <p className="text-xs text-muted-foreground">{t("more", { count: hiddenCount })}</p>
        ) : null}
      </div>
    </LibraryOverviewSection>
  );
}

function isShownRisk(level: ReadingGoalRiskLevel): level is keyof typeof RISK_LABEL_KEY {
  return level in RISK_LABEL_KEY;
}
