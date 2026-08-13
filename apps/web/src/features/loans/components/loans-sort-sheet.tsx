"use client";

import { useTranslations } from "next-intl";

import type { LoansControllerListSort } from "@/shared/api/generated/model";

import { buildMobileSortGroups, MobileSortSheet } from "@/components/ui/mobile-sort-sheet";

import type { LoanDirection } from "../model/loan-pages";

import { LOANS_SORT_VALUES } from "../model/loans-query";

type LoansSortSheetProps = {
  className?: string;
  direction: LoanDirection;
  label: string;
  onChange: (value: LoansControllerListSort) => void;
  value: LoansControllerListSort;
};

type SortGroupKey = "book" | "date" | "person" | "urgency";

const SORT_GROUP_BY_VALUE: Record<LoansControllerListSort, SortGroupKey> = {
  author: "book",
  loan_date: "date",
  overdue_first: "urgency",
  person: "person",
  return_date: "date",
  title: "book",
};

export function LoansSortSheet({
  className,
  direction,
  label,
  onChange,
  value,
}: LoansSortSheetProps) {
  const t = useTranslations("loans.sort.mobile");
  const tOptions = useTranslations(`loans.sort.${direction}`);

  return (
    <MobileSortSheet
      className={className}
      closeLabel={t("close")}
      description={t("description")}
      groups={buildMobileSortGroups({
        groupKeyByValue: SORT_GROUP_BY_VALUE,
        groupLabel: (key) => t(`groups.${key}`),
        optionLabel: (option) => tOptions(option),
        values: LOANS_SORT_VALUES,
      })}
      id="loans-sort"
      label={label}
      onChange={onChange}
      title={t("title")}
      triggerLabel={t(`trigger.${direction}.${value}`)}
      value={value}
    />
  );
}
