"use client";

import type { Nullable } from "@app/shared";

import { LayoutGrid, List } from "lucide-react";
import { useTranslations } from "next-intl";

import { ChipGroup } from "@/components/ui/chip-group";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { GoalsQueryState, GoalsSort, GoalsStatus, GoalsViewMode } from "../model/goals-query";

import { GOALS_QUERY } from "../model/goals-query";

const ALL_STATUSES_CHIP = "all";

type GoalsToolbarProps = {
  onSortChange: (value: GoalsSort) => void;
  onStatusChange: (value: Nullable<GoalsStatus>) => void;
  onViewChange: (value: GoalsViewMode) => void;
  state: GoalsQueryState;
};

export function GoalsToolbar({
  onSortChange,
  onStatusChange,
  onViewChange,
  state,
}: GoalsToolbarProps) {
  const t = useTranslations("goals.catalog");
  const tCommon = useTranslations("common");

  const statusOptions = [
    { label: t("filters.all"), value: ALL_STATUSES_CHIP },
    ...GOALS_QUERY.statusOptions.map((status) => ({
      label: t(`filters.${status}`),
      value: status,
    })),
  ];

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="-mx-1 -my-1 no-scrollbar min-w-0 overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filters.label")}
          mode="single"
          onValueChange={(next) =>
            onStatusChange(GOALS_QUERY.statusOptions.find((status) => status === next) ?? null)
          }
          options={statusOptions}
          size="sm"
          value={state.status ?? ALL_STATUSES_CHIP}
        />
      </div>

      <div className="flex w-full items-center gap-2 sm:gap-2.5 lg:w-auto">
        <div className="min-w-0 flex-1 sm:w-72 sm:flex-none">
          <Select
            onValueChange={(next) => {
              const sort = GOALS_QUERY.sortOptions.find((option) => option === next);
              if (sort !== undefined) onSortChange(sort);
            }}
            value={state.sort}
          >
            <SelectTrigger
              aria-label={t("sort.label")}
              className="h-10 w-full data-[size=default]:h-10"
              clearLabel={tCommon("clear")}
              isClearable={state.sort !== GOALS_QUERY.sortDefault}
              onClear={() => onSortChange(GOALS_QUERY.sortDefault)}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GOALS_QUERY.sortOptions.map((sort) => (
                <SelectItem key={sort} value={sort}>
                  {t(`sort.${sort}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Segmented
          className="ml-auto h-10 shrink-0 items-stretch sm:ml-0 [&_[data-slot=segmented-item]]:py-0 max-sm:[&_[data-slot=segmented-item]]:px-2.5"
          label={t("view.label")}
          onValueChange={(next) => onViewChange(next === "list" ? "list" : "grid")}
          options={[
            {
              icon: <LayoutGrid />,
              label: <span className="max-sm:sr-only">{t("view.grid")}</span>,
              value: "grid",
            },
            {
              icon: <List />,
              label: <span className="max-sm:sr-only">{t("view.list")}</span>,
              value: "list",
            },
          ]}
          value={state.view}
        />
      </div>
    </div>
  );
}
