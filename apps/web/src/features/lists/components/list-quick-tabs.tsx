"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { chipVariants } from "@/components/ui/chip-group";
import { cn } from "@/lib/utils";

import type { ListDetailTab, ListDetailTabCounts } from "../model/list-detail-tabs";

import { LIST_DETAIL_TABS } from "../model/list-detail-tabs";

type ListQuickTabsProps = {
  counts: ListDetailTabCounts;
  onSelect: (tab: ListDetailTab) => void;
  value: Nullable<ListDetailTab>;
};

export function ListQuickTabs({ counts, onSelect, value }: ListQuickTabsProps) {
  const t = useTranslations("lists.details.tabs");

  return (
    <div className="-mx-1 -my-1 no-scrollbar overflow-x-auto px-1 py-1">
      <div aria-label={t("label")} className="flex flex-nowrap gap-2" role="group">
        {LIST_DETAIL_TABS.map((tab) => (
          <button
            aria-pressed={value === tab}
            className={cn(chipVariants({ size: "sm" }))}
            data-state={value === tab ? "on" : "off"}
            key={tab}
            onClick={() => onSelect(tab)}
            type="button"
          >
            {t(tab)}
            <span className="tabular-nums opacity-60">{counts[tab]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
