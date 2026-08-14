"use client";

import { useTranslations } from "next-intl";

import type { LoanHistoryControllerListSort } from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { UseLoanHistoryQueryResult } from "../../model/use-loan-history-query";

import { useLoanHistoryPeople } from "../../api/use-loan-history-people";
import {
  LOAN_HISTORY_RESULT_VALUES,
  LOAN_HISTORY_SORT_DEFAULT,
  LOAN_HISTORY_SORT_VALUES,
  LOAN_HISTORY_TYPE_VALUES,
} from "../../model/loan-history-query";
import { LoanHistoryPeriodFilter } from "./loan-history-period-filter";

type DirectionOption = "all" | (typeof LOAN_HISTORY_TYPE_VALUES)[number];

type SortGroupKey = "book" | "duration" | "loan" | "person" | "returned";

const DIRECTION_OPTIONS = [
  "all",
  ...LOAN_HISTORY_TYPE_VALUES,
] as const satisfies readonly DirectionOption[];

const SORT_GROUP_BY_VALUE = {
  duration_desc: "duration",
  loan_date_desc: "loan",
  person_asc: "person",
  returned_asc: "returned",
  returned_desc: "returned",
  title_asc: "book",
} as const satisfies Record<LoanHistoryControllerListSort, SortGroupKey>;

export function LoanHistoryToolbar({ query }: { query: UseLoanHistoryQueryResult }) {
  const t = useTranslations("loans.history.toolbar");
  const tCommon = useTranslations("common");
  const tDirection = useTranslations("loans.history.direction");
  const tResults = useTranslations("loans.history.results");
  const tSort = useTranslations("loans.history.sort");

  return (
    <div className="flex flex-col gap-3">
      <DebouncedSearchInput
        clearLabel={t("searchClear")}
        label={t("searchLabel")}
        onClear={() => query.setSearch("")}
        onSearch={query.setSearch}
        placeholder={t("searchPlaceholder")}
        value={query.state.q}
      />

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2.5">
        <ToolbarSelect
          label={t("directionLabel")}
          onChange={(value) => query.setType(value === "all" ? null : value)}
          options={DIRECTION_OPTIONS.map((value) => ({ label: tDirection(value), value }))}
          value={query.type ?? "all"}
        />

        <ToolbarSelect
          label={t("resultLabel")}
          onChange={query.setResult}
          options={LOAN_HISTORY_RESULT_VALUES.map((value) => ({ label: tResults(value), value }))}
          value={query.result}
        />

        <PersonSelect
          label={t("personLabel")}
          onChange={query.setContactId}
          value={query.contactId}
        />

        <div className="min-w-0 sm:w-52">
          <LoanHistoryPeriodFilter
            label={t("periodLabel")}
            onChange={query.setPeriod}
            period={query.period}
          />
        </div>

        <div className="col-span-2 flex min-w-0 sm:ml-auto sm:w-56">
          <LoanHistorySortSheet
            className="sm:hidden"
            label={t("sortLabel")}
            onChange={query.setSort}
            value={query.sort}
          />

          <div className="hidden w-full sm:block">
            <ToolbarSelect
              clearable={query.sort !== LOAN_HISTORY_SORT_DEFAULT}
              clearLabel={tCommon("clear")}
              label={t("sortLabel")}
              onChange={query.setSort}
              onClear={() => query.setSort(LOAN_HISTORY_SORT_DEFAULT)}
              options={LOAN_HISTORY_SORT_VALUES.map((value) => ({ label: tSort(value), value }))}
              value={query.sort}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LoanHistorySortSheet({
  className,
  label,
  onChange,
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: LoanHistoryControllerListSort) => void;
  value: LoanHistoryControllerListSort;
}) {
  const t = useTranslations("loans.history.sort.mobile");
  const tOptions = useTranslations("loans.history.sort");

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => tOptions(option),
        values: LOAN_HISTORY_SORT_VALUES,
      })}
      id="loan-history-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${value}`)}
      value={value}
    />
  );
}

function PersonSelect({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const t = useTranslations("loans.history.person");
  const tCommon = useTranslations("common");
  const people = useLoanHistoryPeople();
  const items = people.data?.items ?? [];

  return (
    <div className="min-w-0 sm:w-48">
      <Select onValueChange={onChange} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full data-[size=default]:h-10"
          clearLabel={tCommon("clear")}
          isClearable={value !== ""}
          onClear={() => onChange("")}
        >
          <SelectValue placeholder={t("all")} />
        </SelectTrigger>
        <SelectContent>
          {people.isPending ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("loading")}</p>
          ) : null}
          {!people.isPending && items.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">{t("empty")}</p>
          ) : null}
          {items.map((person) => (
            <SelectItem key={person.contactId} value={person.contactId}>
              <span className="truncate">{person.personName}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                {t("count", { count: person.totalCount })}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToolbarSelect<TValue extends string>({
  clearable = false,
  clearLabel,
  label,
  onChange,
  onClear,
  options,
  value,
}: {
  clearable?: boolean;
  clearLabel?: string;
  label: string;
  onChange: (value: TValue) => void;
  onClear?: () => void;
  options: { label: string; value: TValue }[];
  value: TValue;
}) {
  return (
    <div className="min-w-0 sm:w-48">
      <Select onValueChange={(next) => onChange(next as TValue)} value={value}>
        <SelectTrigger
          aria-label={label}
          className="h-10 w-full data-[size=default]:h-10"
          clearLabel={clearLabel}
          isClearable={clearable}
          onClear={onClear}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
