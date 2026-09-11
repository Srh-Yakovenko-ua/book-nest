"use client";

import type {
  BookOrderStatisticsOrderIdentity,
  BookOrderStatisticsRecords,
  Currency,
  Nullable,
  StatisticsDrilldownScope,
} from "@app/shared";

import { BOOK_ORDER_BEST_VALUE_STORE_RULES, STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type {
  StatisticsDrilldownContext,
  StatisticsDrilldownLink,
} from "../../model/statistics-drilldown";
import type { StatisticsDrilldownUnit } from "./statistics-drilldown-action";

import { formatMoney } from "../../model/money-format";
import { orderDrilldownLink, statisticsDrilldownLinks } from "../../model/statistics-drilldown";
import { monthLabel } from "../../model/statistics-dynamics";
import { formatDayLong, formatPeriodRange } from "../../model/statistics-format";
import { StatisticsCurrencyBadge } from "./statistics-display-currency";
import { StatisticsDrilldownAction } from "./statistics-drilldown-action";
import { StatisticsSection } from "./statistics-section";
import { StatisticsDataQualityNote } from "./statistics-states";

const RECORDS = {
  chevron:
    "shrink-0 text-muted-foreground transition-colors group-hover:text-icon group-focus-visible:text-icon",
  meta: " · ",
  tones: {
    compact: {
      icon: "bg-accent text-icon",
      row: "group flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors outline-none hover:bg-accent/25 focus-visible:ring-[3px] focus-visible:ring-ring",
      value: "text-sm font-semibold text-ink",
    },
    featured: {
      icon: "bg-background text-accent-foreground",
      row: "group flex items-start gap-3 rounded-lg border border-accent-border/60 bg-accent/25 p-3 transition-colors outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring",
      value: "text-base font-semibold text-ink",
    },
  },
} as const;

type RecordAction = {
  label: string;
  links: StatisticsDrilldownLink[];
};

type RecordGroup = {
  featured: Nullable<RecordSlot>;
  key: "financial" | "quantity";
  slots: RecordSlot[];
};

type RecordSlot = {
  hint: Nullable<string>;
  icon: UiIconName;
  key: string;
  missing: string;
  missingHelper: Nullable<string>;
  title: string;
  unit: StatisticsDrilldownUnit;
  winners: RecordWinner[];
};

type RecordTone = (typeof RECORDS.tones)[keyof typeof RECORDS.tones];

type RecordWinner = {
  action: Nullable<RecordAction>;
  helper: Nullable<string>;
  key: string;
  links: StatisticsDrilldownLink[];
  value: string;
};

export function StatisticsRecords({
  currency,
  drilldown,
  records,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownContext;
  records: BookOrderStatisticsRecords;
}) {
  const t = useTranslations("delivery.statistics.records");
  const locale = useLocale();

  const { isTruncated, period } = records.scope;
  const money = (amount: number) => formatMoney({ amount, currency, locale });
  const orderMeta = (order: BookOrderStatisticsOrderIdentity) =>
    [
      order.storeName,
      order.orderNumber,
      t("books", { count: order.booksCount }),
      order.orderDate === null ? null : formatDate(order.orderDate, locale),
    ]
      .filter((part): part is string => part !== null && part !== "")
      .join(RECORDS.meta);
  const scopeDescription = () => {
    const range = formatPeriodRange({ from: period.from, locale, to: period.to });
    if (range !== null) return t("scope.range", { range });
    if (period.from !== null) return t("scope.from", { value: formatDayLong(period.from, locale) });
    if (period.to !== null) return t("scope.to", { value: formatDayLong(period.to, locale) });
    return t("scope.allTime");
  };

  const exactOrderLinks = (order: BookOrderStatisticsOrderIdentity) => {
    const link = orderDrilldownLink({ context: drilldown, order });
    return link === null ? [] : [link];
  };

  const aggregateLinks = (
    breakdown: Parameters<typeof statisticsDrilldownLinks>[0]["breakdown"],
    scope: StatisticsDrilldownScope,
    metricKind: Parameters<typeof statisticsDrilldownLinks>[0]["metricKind"],
  ) =>
    isTruncated
      ? []
      : statisticsDrilldownLinks({ breakdown, context: drilldown, metricKind, scope });

  const storeAndPeriodScope = (store: string): StatisticsDrilldownScope => ({
    from: period.from,
    kind: "store_and_period",
    store,
    to: period.to,
  });

  const recordMonths = winnersFor(records.recordMonthByCurrency, currency);
  const largestOrders = winnersFor(records.largestOrderByCurrency, currency);
  const bestValueStores = winnersFor(records.bestValueStoreByCurrency, currency);

  const groups: RecordGroup[] = [
    {
      featured: {
        hint: null,
        icon: "flame",
        key: "recordMonth",
        missing: t("recordMonth.missing", { currency }),
        missingHelper: null,
        title: t("recordMonth.title"),
        unit: "orders",
        winners: recordMonths.map((month) => ({
          action: null,
          helper: t("recordMonth.helper", {
            books: month.booksCount,
            orders: month.ordersCount,
          }),
          key: month.month,
          links: aggregateLinks(
            month.drilldown,
            { from: month.range.from, kind: "order_date_range", to: month.range.to },
            STATISTICS_METRIC_KIND.currencySpecificMoney,
          ),
          value: `${monthLabel(month.month, locale, true)} · ${money(month.total)}`,
        })),
      },
      key: "financial",
      slots: [
        {
          hint: null,
          icon: "trophy",
          key: "largestOrder",
          missing: t("largestOrder.missing", { currency }),
          missingHelper: null,
          title: t("largestOrder.title"),
          unit: "orders",
          winners: largestOrders.map((order) => ({
            action: null,
            helper: orderMeta(order),
            key: order.id,
            links: exactOrderLinks(order),
            value: money(order.totalAmount),
          })),
        },
        {
          hint: t("bestValue.note"),
          icon: "sparkles",
          key: "bestValue",
          missing: t("bestValue.missing"),
          missingHelper: t("bestValue.missingHelper", {
            count: BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks,
          }),
          title: t("bestValue.title"),
          unit: "books",
          winners: bestValueStores.map((store) => ({
            action: {
              label: t("bestValue.action", { store: store.store }),
              links: statisticsDrilldownLinks({
                breakdown: store.drilldown,
                context: drilldown,
                metricKind: STATISTICS_METRIC_KIND.currencySpecificMoney,
                scope: { kind: "store", store: store.store },
              }),
            },
            helper: t("bestValue.helper", {
              count: store.eligibleBooksCount,
              store: store.store,
            }),
            key: store.storeKey,
            links: [],
            value: money(store.averageLandedBookCost),
          })),
        },
      ],
    },
    {
      featured: null,
      key: "quantity",
      slots: [
        {
          hint: null,
          icon: "library-big",
          key: "mostBooks",
          missing: t("mostBooks.missing"),
          missingHelper: null,
          title: t("mostBooks.title"),
          unit: "orders",
          winners: records.mostBooksInOrder.map((order) => ({
            action: null,
            helper: orderMeta(order),
            key: order.id,
            links: exactOrderLinks(order),
            value: t("mostBooks.value", { count: order.booksCount }),
          })),
        },
        {
          hint: null,
          icon: "store",
          key: "mostActive",
          missing: t("mostActive.missing"),
          missingHelper: null,
          title: t("mostActive.title"),
          unit: "orders",
          winners: records.mostActiveStore.byOrders.map((leader) => ({
            action: null,
            helper: t("mostActive.helper", { books: leader.booksCount }),
            key: leader.storeKey,
            links: aggregateLinks(
              leader.drilldown,
              storeAndPeriodScope(leader.store),
              STATISTICS_METRIC_KIND.countOrStatus,
            ),
            value: t("mostActive.value", { count: leader.ordersCount, store: leader.store }),
          })),
        },
        {
          hint: null,
          icon: "book-open-text",
          key: "mostActiveByBooks",
          missing: t("mostActiveByBooks.missing"),
          missingHelper: null,
          title: t("mostActiveByBooks.title"),
          unit: "books",
          winners: records.mostActiveStore.byBooks.map((leader) => ({
            action: null,
            helper: t("mostActiveByBooks.helper", { orders: leader.ordersCount }),
            key: leader.storeKey,
            links: aggregateLinks(
              leader.drilldown,
              storeAndPeriodScope(leader.store),
              STATISTICS_METRIC_KIND.countOrStatus,
            ),
            value: t("mostActiveByBooks.value", {
              count: leader.booksCount,
              store: leader.store,
            }),
          })),
        },
      ],
    },
  ];

  return (
    <StatisticsSection
      className="flex h-full flex-col"
      contentClassName="flex-1"
      description={scopeDescription()}
      title={t("title")}
    >
      {groups.map((group) => (
        <section className="flex flex-col gap-2" key={group.key}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {t(`groups.${group.key}`)}
            </h3>
            {group.key === "financial" ? <StatisticsCurrencyBadge currency={currency} /> : null}
          </div>

          {group.featured === null ? null : (
            <RecordEntry slot={group.featured} tone={RECORDS.tones.featured} />
          )}

          <ul className="flex flex-col divide-y divide-border">
            {group.slots.map((slot) => (
              <li key={slot.key}>
                <RecordEntry slot={slot} tone={RECORDS.tones.compact} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {isTruncated ? (
        <div className="mt-auto border-t border-border pt-3">
          <StatisticsDataQualityNote kind="truncated">
            <span>
              <span className="font-medium">{t("truncated.title")}</span> · {t("truncated.helper")}
            </span>
          </StatisticsDataQualityNote>
        </div>
      ) : null}
    </StatisticsSection>
  );
}

function RecordContextAction({ action }: { action: RecordAction }) {
  const only = action.links.at(0);

  if (only === undefined) {
    return null;
  }

  return action.links.length === 1 ? (
    <Link
      className="w-fit pl-11 text-xs text-primary underline-offset-2 hover:underline"
      href={only.href}
    >
      {action.label} →
    </Link>
  ) : (
    <StatisticsDrilldownAction
      className="w-fit pl-11 text-xs text-primary underline-offset-2 hover:underline"
      label={action.label}
      links={action.links}
      unit="orders"
    >
      {action.label} →
    </StatisticsDrilldownAction>
  );
}

function RecordEntry({ slot, tone }: { slot: RecordSlot; tone: RecordTone }) {
  const t = useTranslations("delivery.statistics.records");
  const soleWinner = slot.winners.length === 1 ? slot.winners.at(0) : undefined;

  const winnerLabel = (winner: RecordWinner) =>
    t("winnerLabel", {
      record: slot.title,
      value:
        winner.helper === null ? winner.value : `${winner.value}${RECORDS.meta}${winner.helper}`,
    });

  const label = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {slot.title}
      {slot.hint === null ? null : <RecordHint text={slot.hint} />}
    </span>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {soleWinner === undefined ? (
        <div className={tone.row}>
          <RecordIcon className={tone.icon} name={slot.icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {label}
            {slot.winners.length === 0 ? (
              <RecordUnavailable helper={slot.missingHelper} title={slot.missing} />
            ) : (
              slot.winners.map((winner) => (
                <StatisticsDrilldownAction
                  className="group flex items-center gap-3 rounded-md transition-colors outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring"
                  key={winner.key}
                  label={winnerLabel(winner)}
                  links={winner.links}
                  unit={slot.unit}
                >
                  <RecordValueText tone={tone} winner={winner} />
                  {winner.links.length === 0 ? null : (
                    <UiIcon
                      aria-hidden
                      className={RECORDS.chevron}
                      name="chevron-right"
                      size={16}
                    />
                  )}
                </StatisticsDrilldownAction>
              ))
            )}
          </div>
        </div>
      ) : (
        <StatisticsDrilldownAction
          className={tone.row}
          label={winnerLabel(soleWinner)}
          links={soleWinner.links}
          unit={slot.unit}
        >
          <RecordIcon className={tone.icon} name={slot.icon} />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {label}
            <RecordValueText tone={tone} winner={soleWinner} />
          </span>
          {soleWinner.links.length === 0 ? null : (
            <UiIcon aria-hidden className={RECORDS.chevron} name="chevron-right" size={16} />
          )}
        </StatisticsDrilldownAction>
      )}

      {slot.winners.flatMap((winner) =>
        winner.action === null
          ? []
          : [<RecordContextAction action={winner.action} key={winner.key} />],
      )}
    </div>
  );
}

function RecordHint({ text }: { text: string }) {
  const t = useTranslations("delivery.statistics.records");

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={t("hintLabel")}
        className="-m-1.5 grid size-6 cursor-help place-items-center text-muted-foreground transition-colors hover:text-foreground"
        type="button"
      >
        <UiIcon name="info" size={13} />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

function RecordIcon({ className, name }: { className: string; name: UiIconName }) {
  return (
    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", className)}>
      <UiIcon aria-hidden name={name} size={16} />
    </span>
  );
}

function RecordUnavailable({ helper, title }: { helper: Nullable<string>; title: string }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm text-muted-foreground">{title}</span>
      {helper === null ? null : <span className="text-xs text-muted-foreground">{helper}</span>}
    </span>
  );
}

function RecordValueText({ tone, winner }: { tone: RecordTone; winner: RecordWinner }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className={cn("truncate", tone.value)}>{winner.value}</span>
      {winner.helper === null ? null : (
        <span className="truncate text-xs text-muted-foreground">{winner.helper}</span>
      )}
    </span>
  );
}

function winnersFor<Winner>(
  entries: readonly { currency: Currency; winners: Winner[] }[],
  currency: Currency,
): Winner[] {
  return entries.find((entry) => entry.currency === currency)?.winners ?? [];
}
