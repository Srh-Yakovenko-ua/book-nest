"use client";

import type { BookBudgetOverview, BookBudgetStatus, Currency } from "@app/shared";
import type { ReactNode } from "react";

import { BOOK_BUDGET_RULES } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";

import { useCancelScheduledBudget } from "../../api/use-book-budgets";
import { formatMoney } from "../../model/money-format";
import { monthLabel } from "../../model/statistics-dynamics";
import { StatisticsBudgetDialog } from "./statistics-budget-dialog";
import { StatisticsCurrencyTabs, StatisticsSection } from "./statistics-section";

export function StatisticsBudget({
  currency,
  isLoading,
  onCurrencyChange,
  overview,
}: {
  currency: Currency;
  isLoading: boolean;
  onCurrencyChange: (currency: Currency) => void;
  overview: BookBudgetOverview | undefined;
}) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const configured = overview?.budgets ?? [];
  const currencies = configured.map((entry) => entry.currency);
  const active = configured.find((entry) => entry.currency === currency) ?? configured[0] ?? null;

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {currencies.length > 1 && active !== null ? (
            <StatisticsCurrencyTabs
              currencies={currencies}
              label={t("currencyLabel")}
              onChange={onCurrencyChange}
              value={active.currency}
            />
          ) : null}
          {configured.length === 0 ? null : (
            <Button onClick={() => setDialogOpen(true)} size="lg" variant="secondary">
              {t("edit")}
            </Button>
          )}
        </div>
      }
      description={
        overview === undefined
          ? undefined
          : t("monthCaption", { month: monthLabel(overview.month.slice(0, 7), locale, true) })
      }
      title={t("title")}
    >
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : active === null ? (
        <div className="flex flex-col items-start gap-3">
          <p className="max-w-md text-sm text-muted-foreground">{t("emptyDescription")}</p>
          <Button onClick={() => setDialogOpen(true)}>{t("emptyCta")}</Button>
        </div>
      ) : (
        <BudgetStatus status={active} />
      )}

      <StatisticsBudgetDialog
        onOpenChange={setDialogOpen}
        open={isDialogOpen}
        overview={overview}
      />
    </StatisticsSection>
  );
}

function BudgetStatus({ status }: { status: BookBudgetStatus }) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();
  const cancelScheduled = useCancelScheduledBudget();
  const { currency, currentMonth, scheduled } = status;
  const money = (amount: number) => formatMoney({ amount, currency, locale });

  if (currentMonth === null) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("notActiveYet")}</p>
        {scheduled === null ? null : (
          <ScheduledLine
            currency={currency}
            isPending={cancelScheduled.isPending}
            onCancel={() => cancelScheduled.mutate(currency)}
            scheduled={scheduled}
          />
        )}
      </div>
    );
  }

  const usedPercent = Math.min(currentMonth.usedPercent, 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-heading text-xl font-bold text-ink tabular-nums">
          {t("progress", {
            budget: money(currentMonth.budget),
            spent: money(currentMonth.spentToDate),
          })}
        </span>
        <span className="text-sm text-muted-foreground tabular-nums">
          {formatNumber(currentMonth.usedPercent, locale, { maximumFractionDigits: 0 })}%
        </span>
      </div>

      <Progress
        aria-label={t("progressAria", { currency })}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(usedPercent)}
        className="h-2"
        value={usedPercent}
      />

      <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
        <li>
          {currentMonth.remainingSigned >= 0
            ? t("remaining", { value: money(currentMonth.remaining) })
            : t("exceeded", { value: money(Math.abs(currentMonth.remainingSigned)) })}
        </li>
        <li>
          {currentMonth.forecast === null
            ? t("forecastPending", { days: BOOK_BUDGET_RULES.forecastMinimumElapsedDays })
            : t("forecast", { value: money(currentMonth.forecast) })}
        </li>
        {currentMonth.projectedOverage === null || currentMonth.projectedOverage <= 0 ? null : (
          <li className="inline-flex items-center gap-1.5 text-favorite">
            <UiIcon name="alert-circle" size={14} />
            {t("projectedOverage", { value: money(currentMonth.projectedOverage) })}
          </li>
        )}
      </ul>

      {scheduled === null ? (
        <StoppingLine currentMonth={currentMonth} />
      ) : (
        <ScheduledLine
          currency={currency}
          isPending={cancelScheduled.isPending}
          onCancel={() => cancelScheduled.mutate(currency)}
          scheduled={scheduled}
        />
      )}
    </div>
  );
}

function ScheduledLine({
  currency,
  isPending,
  onCancel,
  scheduled,
}: {
  currency: Currency;
  isPending: boolean;
  onCancel: () => void;
  scheduled: NonNullable<BookBudgetStatus["scheduled"]>;
}) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();

  return (
    <TimelineNote>
      {t("scheduled", {
        month: monthLabel(scheduled.validFromMonth.slice(0, 7), locale, true),
        value: formatMoney({ amount: scheduled.monthlyAmount, currency, locale }),
      })}
      <Button
        className="h-6 px-2 text-xs"
        disabled={isPending}
        onClick={() => {
          onCancel();
          toast.success(t("scheduledCancelled"));
        }}
        size="sm"
        variant="ghost"
      >
        {t("cancelScheduled")}
      </Button>
    </TimelineNote>
  );
}

function StoppingLine({
  currentMonth,
}: {
  currentMonth: NonNullable<BookBudgetStatus["currentMonth"]>;
}) {
  const t = useTranslations("delivery.statistics.budget");
  const locale = useLocale();

  if (currentMonth.validToMonth === null) return null;

  return (
    <TimelineNote>
      {t("stopping", { month: monthLabel(currentMonth.validToMonth.slice(0, 7), locale, true) })}
    </TimelineNote>
  );
}

function TimelineNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-xs text-icon">
      {children}
    </p>
  );
}
