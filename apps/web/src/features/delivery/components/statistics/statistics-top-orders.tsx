"use client";

import type {
  BookOrderStatisticsFinancialCoverage,
  BookOrderStatisticsTopOrder,
  BookOrderStatisticsTopOrdersByCurrency,
  Currency,
  Nullable,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";

import { formatMoney } from "../../model/money-format";
import { toOrderStatusBadge } from "../../model/order-status-badge";
import { orderDrilldownLink } from "../../model/statistics-drilldown";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote, StatisticsSectionState } from "./statistics-states";

const TOP_ORDERS = {
  meta: " · ",
  pageButton: "aria-disabled:pointer-events-none aria-disabled:opacity-50",
  pageSize: 5,
  rankTones: {
    first: "border-transparent bg-primary text-primary-foreground",
    rest: "border-transparent bg-secondary text-muted-foreground",
    second: "border-accent-border bg-accent text-accent-foreground",
    third: "border-accent-border/50 bg-accent/50 text-accent-foreground",
  },
  row: "group grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-accent/25 focus-visible:ring-[3px] focus-visible:ring-ring sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
} as const;

export function StatisticsTopOrders({
  currency,
  drilldown,
  financialCoverageByCurrency,
  scopeKey,
  topOrdersByCurrency,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  financialCoverageByCurrency: readonly BookOrderStatisticsFinancialCoverage[];
  scopeKey: string;
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency;
}) {
  const t = useTranslations("delivery.statistics.topOrders");
  const [page, setPage] = useState(1);
  const rankingScope = `${currency}|${scopeKey}`;
  const [seenRankingScope, setSeenRankingScope] = useState(rankingScope);

  if (seenRankingScope !== rankingScope) {
    setSeenRankingScope(rankingScope);
    setPage(1);
  }

  const orders = topOrdersByCurrency.find((entry) => entry.currency === currency)?.orders ?? [];
  const peak = orders.at(0)?.totalAmount ?? 0;

  const pageCount = Math.max(1, Math.ceil(orders.length / TOP_ORDERS.pageSize));

  if (page > pageCount) {
    setPage(pageCount);
  }

  const currentPage = Math.min(page, pageCount);
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === pageCount;
  const firstIndex = (currentPage - 1) * TOP_ORDERS.pageSize;
  const visible = orders.slice(firstIndex, firstIndex + TOP_ORDERS.pageSize);

  const coverage = financialCoverageByCurrency.find((entry) => entry.currency === currency) ?? null;
  const partialCoverage =
    coverage !== null && coverage.ordersWithResolvedAmount < coverage.ordersInScope
      ? coverage
      : null;

  return (
    <StatisticsSection
      action={<StatisticsCurrencyBadge currency={currency} />}
      className="flex h-full flex-col"
      contentClassName="flex-1"
      description={t("subtitle")}
      title={t("title")}
    >
      {orders.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("emptyForCurrency", { currency })} />
      ) : (
        <>
          {orders.length <= TOP_ORDERS.pageSize ? null : (
            <div className="flex items-center justify-end gap-2">
              <span aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
                {t("pageRange", {
                  from: firstIndex + 1,
                  to: firstIndex + visible.length,
                  total: orders.length,
                })}
              </span>
              <span className="inline-flex items-center gap-1">
                <Button
                  aria-disabled={isFirstPage}
                  aria-label={t("previousPage")}
                  className={TOP_ORDERS.pageButton}
                  onClick={() => {
                    if (isFirstPage) return;
                    setPage(currentPage - 1);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="chevron-left" size={16} />
                </Button>
                <Button
                  aria-disabled={isLastPage}
                  aria-label={t("nextPage")}
                  className={TOP_ORDERS.pageButton}
                  onClick={() => {
                    if (isLastPage) return;
                    setPage(currentPage + 1);
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="chevron-right" size={16} />
                </Button>
              </span>
            </div>
          )}

          <ol className="flex flex-1 flex-col divide-y divide-border">
            {visible.map((order, index) => (
              <TopOrderRow
                drilldown={drilldown}
                key={order.id}
                order={order}
                peak={peak}
                rank={firstIndex + index + 1}
              />
            ))}
          </ol>

          {partialCoverage === null ? null : (
            <StatisticsDataQualityNote kind="partial">
              {t("coverage", {
                covered: partialCoverage.ordersWithResolvedAmount,
                total: partialCoverage.ordersInScope,
              })}
            </StatisticsDataQualityNote>
          )}
        </>
      )}
    </StatisticsSection>
  );
}

function rankToneOf(rank: number): string {
  if (rank === 1) return TOP_ORDERS.rankTones.first;
  if (rank === 2) return TOP_ORDERS.rankTones.second;
  if (rank === 3) return TOP_ORDERS.rankTones.third;
  return TOP_ORDERS.rankTones.rest;
}

function shareOf({ peak, value }: { peak: number; value: Nullable<number> }): number {
  if (peak <= 0 || value === null || value <= 0) return 0;
  return Math.min(value / peak, 1);
}

function TopOrderRow({
  drilldown,
  order,
  peak,
  rank,
}: {
  drilldown: StatisticsDrilldownContext;
  order: BookOrderStatisticsTopOrder;
  peak: number;
  rank: number;
}) {
  const t = useTranslations("delivery.statistics.topOrders");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();

  const meta = [
    order.storeName,
    order.orderDate === null ? null : formatDate(order.orderDate, locale),
    t("books", { count: order.booksCount }),
  ]
    .filter((part): part is string => part !== null && part !== "")
    .join(TOP_ORDERS.meta);

  const link = orderDrilldownLink({ context: drilldown, order });

  const body = (
    <>
      <span
        className={cn(
          "col-start-1 col-end-2 row-start-1 grid size-7 shrink-0 place-items-center self-start rounded-full border text-xs font-semibold tabular-nums sm:row-end-3",
          rankToneOf(rank),
        )}
      >
        {rank}
      </span>
      <span className="col-start-2 col-end-3 row-start-1 min-w-0 truncate text-sm font-medium text-ink">
        {order.orderNumber ?? t("untitledOrder")}
      </span>
      <UiIcon
        aria-hidden
        className="col-start-3 col-end-4 row-start-1 self-start text-muted-foreground transition-colors group-hover:text-icon group-focus-visible:text-icon sm:col-start-4 sm:col-end-5 sm:row-end-4 sm:self-center"
        name="chevron-right"
        size={16}
      />
      <span className="col-start-2 col-end-4 row-start-2 min-w-0 truncate text-xs text-muted-foreground sm:col-end-3">
        {meta}
      </span>
      <span className="col-start-2 col-end-4 row-start-3 text-sm font-semibold text-ink tabular-nums sm:col-start-3 sm:row-start-1 sm:justify-self-end">
        {formatMoney({ amount: order.totalAmount, currency: order.currency, locale })}
      </span>
      <span className="col-start-2 col-end-4 row-start-4 sm:col-start-3 sm:row-start-2 sm:justify-self-end">
        <StatusBadge entry={toOrderStatusBadge(order.derivedStatus, tStatus)} />
      </span>
      <span className="col-start-2 col-end-4 row-start-5 sm:row-start-3">
        <ValueBar share={shareOf({ peak, value: order.totalAmount })} />
      </span>
    </>
  );

  return (
    <li>
      {link === null ? (
        <div className={TOP_ORDERS.row}>{body}</div>
      ) : (
        <Link className={TOP_ORDERS.row} href={link.href}>
          {body}
        </Link>
      )}
    </li>
  );
}

function ValueBar({ share }: { share: number }) {
  return (
    <span aria-hidden className="block h-1.5 w-full rounded-full bg-accent/40">
      <span
        className="block h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
        data-testid="top-order-bar"
        style={{ width: `${share * 100}%` }}
      />
    </span>
  );
}
