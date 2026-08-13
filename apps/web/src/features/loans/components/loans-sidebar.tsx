"use client";

import type { LoanDirectionSummary, LoanListItemView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";

import type { AttentionItem } from "@/components/attention-block";
import type { UiIconName } from "@/components/icons";

import { AttentionBlock } from "@/components/attention-block";
import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIso } from "@/features/books/model/reading-progress";
import { LoansControllerListFilter } from "@/shared/api/generated/model";

import type { LoanDirection } from "../model/loan-pages";

import { daysBetweenLoanDates, loanRelative } from "../model/loans-derive";

const LOAN_ATTENTION_FILTERS = [
  LoansControllerListFilter.overdue,
  LoansControllerListFilter.no_return_date,
] as const;

type LoanAttentionFilter = (typeof LOAN_ATTENTION_FILTERS)[number];

const LOAN_ATTENTION_LOOK = {
  no_return_date: { icon: "circle-slash", toneClass: "text-warning" },
  overdue: { icon: "alert-triangle", toneClass: "text-error" },
} as const satisfies Record<LoanAttentionFilter, { icon: UiIconName; toneClass: string }>;

export type LoansAttention = {
  activeFilter: LoansControllerListFilter;
  onFilterSelect: (filter: LoanAttentionFilter) => void;
  stats: Nullable<LoanDirectionSummary>;
};

type LoansSidebarProps = {
  attention: Nullable<LoansAttention>;
  direction: LoanDirection;
  isLoading: boolean;
  longHeldLoans: LoanListItemView[];
  onAddBook: () => void;
  upcomingReturns: LoanListItemView[];
};

export function LoansSidebar(props: LoansSidebarProps) {
  const t = useTranslations("loans.sidebar");

  return (
    <aside
      aria-label={t("label")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <LoansSidebarSections {...props} />
    </aside>
  );
}

export function LoansSidebarSections({
  attention,
  direction,
  isLoading,
  longHeldLoans,
  onAddBook,
  upcomingReturns,
}: LoansSidebarProps) {
  const t = useTranslations("loans.sidebar");

  if (direction === "borrowed") {
    return (
      <>
        {attention === null ? null : <LoansAttentionBlock {...attention} isLoading={isLoading} />}

        <SidebarBlock title={t("longHeld.title")}>
          <LoanRows
            emptyText={t("longHeld.empty")}
            isLoading={isLoading}
            loans={longHeldLoans}
            renderMeta={(loan) => <LongHeldDays loanDate={loan.loanDate} />}
          />
        </SidebarBlock>
      </>
    );
  }

  return (
    <>
      <SidebarBlock title={t("upcoming.title")}>
        <LoanRows
          emptyText={t("upcoming.empty")}
          isLoading={isLoading}
          loans={upcomingReturns}
          renderMeta={(loan) => (
            <UpcomingReturnLabel expectedReturnDate={loan.expectedReturnDate} />
          )}
        />
      </SidebarBlock>

      <SidebarBlock title={t("cta.title")}>
        <p className="text-xs leading-relaxed text-muted-foreground">{t("cta.text")}</p>
        <Button className="justify-start" onClick={onAddBook} variant="secondary">
          <UiIcon name="plus" size={16} />
          {t("cta.button")}
        </Button>
      </SidebarBlock>
    </>
  );
}

function LoanRows({
  emptyText,
  isLoading,
  loans,
  renderMeta,
}: {
  emptyText: string;
  isLoading: boolean;
  loans: LoanListItemView[];
  renderMeta: (loan: LoanListItemView) => ReactNode;
}) {
  if (isLoading) return <RowSkeleton rows={3} />;

  if (loans.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="-mx-1.5 flex flex-col gap-0.5">
      {loans.map((loan) => (
        <SidebarLoanRow key={loan.id} loan={loan} meta={renderMeta(loan)} />
      ))}
    </ul>
  );
}

function LoansAttentionBlock({
  activeFilter,
  isLoading,
  onFilterSelect,
  stats,
}: LoansAttention & { isLoading: boolean }) {
  const t = useTranslations("loans.sidebar.attention");
  const tStats = useTranslations("loans.stats");

  const daysSinceOldestOverdue = daysBetweenLoanDates(
    stats?.oldestOverdueReturnDate ?? null,
    todayIso(),
  );

  const counts: Record<LoanAttentionFilter, number> = {
    no_return_date: stats?.noReturnDateCount ?? 0,
    overdue: stats?.overdueCount ?? 0,
  };

  const details: Partial<Record<LoanAttentionFilter, string>> = {
    no_return_date: t("no_return_date.detail"),
    overdue:
      daysSinceOldestOverdue === null
        ? undefined
        : tStats("overdue.longest", { count: daysSinceOldestOverdue }),
  };

  const items: AttentionItem<LoanAttentionFilter>[] = LOAN_ATTENTION_FILTERS.filter(
    (filter) => counts[filter] > 0,
  ).map((filter) => ({
    ...LOAN_ATTENTION_LOOK[filter],
    detail: details[filter],
    id: filter,
    label: t(`${filter}.label`, { count: counts[filter] }),
  }));

  return (
    <AttentionBlock
      activeId={LOAN_ATTENTION_FILTERS.find((filter) => filter === activeFilter) ?? null}
      allClearLabel={t("allClear.text")}
      allClearTitle={t("allClear.title")}
      isLoading={isLoading}
      items={items}
      onSelect={onFilterSelect}
      title={t("title")}
    />
  );
}

function LongHeldDays({ loanDate }: { loanDate: Nullable<string> }) {
  const t = useTranslations("loans.sidebar.longHeld");
  const daysWithUser = daysBetweenLoanDates(loanDate, todayIso());

  if (daysWithUser === null) return null;

  return <>{t("days", { count: daysWithUser })}</>;
}

function RowSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-2.5" key={index}>
          <Skeleton className="aspect-[3/4] w-8 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Skeleton className="h-3.5 w-4/5" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SidebarBlock({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function SidebarLoanCover({ alt, src }: { alt: string; src: Nullable<string> }) {
  if (src === null) {
    return (
      <div className="grid aspect-[3/4] w-8 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground/70">
        <UiIcon name="book" size={14} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-8 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image alt={alt} className="object-cover" fill sizes="32px" src={src} unoptimized />
    </div>
  );
}

function SidebarLoanRow({ loan, meta }: { loan: LoanListItemView; meta: ReactNode }) {
  return (
    <li>
      <MobilePageOverviewLink
        className="group/loan flex items-center gap-2.5 rounded-md px-1.5 py-1.5 no-underline transition-colors hover:bg-secondary motion-reduce:transition-none"
        href={`/books/${loan.book.id}`}
      >
        <SidebarLoanCover alt={loan.book.title} src={loan.book.cover?.urls.thumb ?? null} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-ink transition-colors group-hover/loan:text-primary">
            {loan.book.title}
          </span>
          <span className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{loan.personName}</span>
            <span className="shrink-0 font-medium">{meta}</span>
          </span>
        </span>
      </MobilePageOverviewLink>
    </li>
  );
}

function UpcomingReturnLabel({ expectedReturnDate }: { expectedReturnDate: Nullable<string> }) {
  const t = useTranslations("loans.sidebar.upcoming");
  const relative = loanRelative(expectedReturnDate, todayIso());

  if (relative.kind === "today") return <>{t("today")}</>;
  if (relative.kind !== "soon") return null;
  if (relative.days === 1) return <>{t("tomorrow")}</>;

  return <>{t("inDays", { count: relative.days })}</>;
}
