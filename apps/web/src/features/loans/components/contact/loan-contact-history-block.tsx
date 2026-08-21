"use client";

import type {
  LoanHistoryListItemView,
  LoanHistoryOverviewView,
  LoanHistoryResult,
} from "@app/shared";
import type { VariantProps } from "class-variance-authority";

import { useTranslations } from "next-intl";

import { Badge, badgeVariants } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { useLoanHistory } from "../../api/use-loan-history";
import { useLoanHistoryOverview } from "../../api/use-loan-history-overview";
import { toContactHistoryParams } from "../../model/loan-contact-preview";
import { formatLoanDate } from "../../model/loans-derive";
import { LoanContactPreviewRow, LoanContactPreviewSkeleton } from "./loan-contact-preview-row";

const RESULT_BADGE_VARIANT = {
  late: "warning",
  no_due_date: "secondary",
  on_time: "success",
} as const satisfies Record<LoanHistoryResult, VariantProps<typeof badgeVariants>["variant"]>;

export function LoanContactHistoryBlock({ contactId }: { contactId: string }) {
  const t = useTranslations("loans.contactDrawer.history");
  const overview = useLoanHistoryOverview({ contactId });
  const history = useLoanHistory(toContactHistoryParams(contactId));

  const items = history.data?.pages[0]?.items ?? [];
  const isPending = overview.isPending || history.isPending;
  const isEmpty = !isPending && (overview.data?.summary.totalCompleted ?? 0) === 0;

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t("title")}
      </h3>

      {isPending ? (
        <>
          <StatsSkeleton />
          <LoanContactPreviewSkeleton rows={2} />
        </>
      ) : null}

      {isEmpty ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}

      {!isPending && !isEmpty && overview.data !== undefined ? (
        <HistoryStats summary={overview.data.summary} />
      ) : null}

      {!isPending && items.length > 0 ? (
        <>
          <h4 className="text-xs font-medium text-muted-foreground">{t("recentTitle")}</h4>
          <ul className="flex flex-col gap-2.5">
            {items.map((loan) => (
              <LoanContactPreviewRow
                book={loan.book}
                key={loan.id}
                meta={<HistoryMeta loan={loan} />}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}

function HistoryMeta({ loan }: { loan: LoanHistoryListItemView }) {
  const t = useTranslations("loans.contactDrawer.history");
  const tResult = useTranslations("loans.history.result");

  return (
    <>
      <Badge variant={RESULT_BADGE_VARIANT[loan.historyResult]}>
        {loan.historyResult === "late"
          ? tResult("late", { count: loan.delayDays ?? 0 })
          : tResult(loan.historyResult)}
      </Badge>
      <span className="tabular-nums">
        {t("returnedOn", { date: formatLoanDate(loan.returnedDate) ?? loan.returnedDate })}
      </span>
    </>
  );
}

function HistoryStats({ summary }: { summary: LoanHistoryOverviewView["summary"] }) {
  const t = useTranslations("loans.contactDrawer.history");
  const tDuration = useTranslations("loans.history.duration");

  const stats = [
    { label: t("completed"), value: String(summary.totalCompleted) },
    { label: t("onTime"), value: String(summary.onTimeCount) },
    { label: t("late"), value: String(summary.lateCount) },
    {
      label: t("averageDuration"),
      value:
        summary.averageDurationDays === null
          ? t("durationUnknown")
          : tDuration("days", { count: summary.averageDurationDays }),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-2">
      {stats.map((stat) => (
        <div
          className="flex flex-col gap-0.5 rounded-lg bg-secondary/60 px-3 py-2"
          key={stat.label}
        >
          <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          <dd className="text-sm font-semibold text-ink tabular-nums">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton className="h-14 rounded-lg" key={index} />
      ))}
    </div>
  );
}
