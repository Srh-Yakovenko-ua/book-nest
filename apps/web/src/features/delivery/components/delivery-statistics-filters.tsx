"use client";

import type { Currency, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { DeliveryControllerStatisticsStatus } from "@/shared/api/generated/model";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { DeliveryStatisticsQueryState } from "../model/statistics-params";
import type { StatisticsFilterPatch } from "../model/use-statistics-params";

import {
  DELIVERY_STATISTICS_CURRENCIES,
  DELIVERY_STATISTICS_STATUSES,
} from "../model/statistics-params";

type DeliveryStatisticsFiltersProps = {
  filterCount: number;
  onApply: (patch: StatisticsFilterPatch) => void;
  onReset: () => void;
  state: DeliveryStatisticsQueryState;
};

type FilterDraft = {
  currency: Nullable<Currency>;
  from: string;
  status: Nullable<DeliveryControllerStatisticsStatus>;
  store: string;
  to: string;
};

const ANY_VALUE = "any";

export function DeliveryStatisticsFilters({
  filterCount,
  onApply,
  onReset,
  state,
}: DeliveryStatisticsFiltersProps) {
  const t = useTranslations("delivery.statistics.filters");
  const tBadge = useTranslations("delivery.badge");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterDraft>(() => toDraft(state));

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(state));
    setOpen(next);
  }

  function apply() {
    onApply(toPatch(draft));
    setOpen(false);
  }

  function reset() {
    onReset();
    setOpen(false);
  }

  function patch(next: Partial<FilterDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button className="relative" variant="secondary">
          <UiIcon name="funnel" size={16} />
          {t("label")}
          {filterCount > 0 ? (
            <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
              {filterCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="stats-filter-currency">
              {t("currency")}
            </Label>
            <Select
              onValueChange={(value) =>
                patch({ currency: value === ANY_VALUE ? null : (value as Currency) })
              }
              value={draft.currency ?? ANY_VALUE}
            >
              <SelectTrigger className="h-9 w-full" id="stats-filter-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("any")}</SelectItem>
                {DELIVERY_STATISTICS_CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="stats-filter-status">
              {t("status")}
            </Label>
            <Select
              onValueChange={(value) =>
                patch({
                  status:
                    value === ANY_VALUE ? null : (value as DeliveryControllerStatisticsStatus),
                })
              }
              value={draft.status ?? ANY_VALUE}
            >
              <SelectTrigger className="h-9 w-full" id="stats-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("any")}</SelectItem>
                {DELIVERY_STATISTICS_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {tBadge(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground" htmlFor="stats-filter-store">
              {t("store")}
            </Label>
            <Input
              id="stats-filter-store"
              onChange={(event) => patch({ store: event.target.value })}
              placeholder={t("storePlaceholder")}
              value={draft.store}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="stats-filter-from">
                {t("from")}
              </Label>
              <Input
                id="stats-filter-from"
                onChange={(event) => patch({ from: event.target.value })}
                type="date"
                value={draft.from}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="stats-filter-to">
                {t("to")}
              </Label>
              <Input
                id="stats-filter-to"
                onChange={(event) => patch({ to: event.target.value })}
                type="date"
                value={draft.to}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button onClick={reset} size="sm" variant="ghost">
              {t("reset")}
            </Button>
            <Button onClick={apply} size="sm">
              {t("apply")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toDraft(state: DeliveryStatisticsQueryState): FilterDraft {
  return {
    currency: state.currency,
    from: state.from,
    status: state.status,
    store: state.store,
    to: state.to,
  };
}

function toPatch(draft: FilterDraft): StatisticsFilterPatch {
  return {
    currency: draft.currency,
    from: draft.from,
    status: draft.status,
    store: draft.store.trim(),
    to: draft.to,
  };
}
