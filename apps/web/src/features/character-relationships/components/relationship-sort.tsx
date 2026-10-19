"use client";

import { useTranslations } from "next-intl";

import { MobileSortSheet } from "@/components/ui/mobile-sort-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RelationshipListSort } from "../model/relationship-list-query";

import { RELATIONSHIP_LIST_QUERY, toRelationshipListSort } from "../model/relationship-list-query";

type RelationshipSortProps = {
  onChange: (sort: RelationshipListSort) => void;
  value: RelationshipListSort;
};

export function RelationshipSort({ onChange, value }: RelationshipSortProps) {
  const t = useTranslations("relationships.sort");
  const tCommon = useTranslations("common");

  return (
    <>
      <MobileSortSheet
        className="sm:hidden"
        closeLabel={t("mobile.close")}
        description={t("mobile.description")}
        groups={[
          {
            key: "sort",
            options: RELATIONSHIP_LIST_QUERY.sortOptions.map((option) => ({
              label: t(`options.${option}`),
              value: option,
            })),
          },
        ]}
        id="relationships-sort"
        label={t("label")}
        onChange={onChange}
        title={t("mobile.title")}
        triggerLabel={t(`options.${value}`)}
        value={value}
      />

      <div className="hidden sm:block sm:w-56">
        <Select onValueChange={(next) => onChange(toRelationshipListSort(next))} value={value}>
          <SelectTrigger
            aria-label={t("label")}
            className="w-full data-[size=default]:h-10"
            clearLabel={tCommon("clear")}
            isClearable={value !== RELATIONSHIP_LIST_QUERY.sortDefault}
            onClear={() => onChange(RELATIONSHIP_LIST_QUERY.sortDefault)}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RELATIONSHIP_LIST_QUERY.sortOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {t(`options.${option}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
