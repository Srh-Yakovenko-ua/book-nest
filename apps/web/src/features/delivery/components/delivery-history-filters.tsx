"use client";

import type { Currency, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

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

import type { DeliveryHistoryQueryState } from "../model/history-params";
import type { HistoryFilterPatch } from "../model/use-history-params";

import { DELIVERY_CURRENCY_OPTIONS } from "../model/history-params";

type DeliveryHistoryFiltersProps = {
  filterCount: number;
  onApply: (patch: HistoryFilterPatch) => void;
  onReset: () => void;
  state: DeliveryHistoryQueryState;
};

type FilterDraft = {
  currency: Nullable<Currency>;
  from: string;
  hasTrackingNumber: TriState;
  hasTrackingUrl: TriState;
  priceMax: string;
  priceMin: string;
  service: string;
  store: string;
  to: string;
};

type TriState = "any" | "no" | "yes";

const ANY_VALUE = "any";

export function DeliveryHistoryFilters({
  filterCount,
  onApply,
  onReset,
  state,
}: DeliveryHistoryFiltersProps) {
  const t = useTranslations("delivery.history.filters");
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
    setDraft(toDraft(emptyState(state)));
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
          <FilterField htmlFor="history-filter-currency" label={t("currency")}>
            <Select
              onValueChange={(value) =>
                patch({ currency: value === ANY_VALUE ? null : (value as Currency) })
              }
              value={draft.currency ?? ANY_VALUE}
            >
              <SelectTrigger className="h-9 w-full" id="history-filter-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY_VALUE}>{t("any")}</SelectItem>
                {DELIVERY_CURRENCY_OPTIONS.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField htmlFor="history-filter-store" label={t("store")}>
            <Input
              id="history-filter-store"
              onChange={(event) => patch({ store: event.target.value })}
              placeholder={t("storePlaceholder")}
              value={draft.store}
            />
          </FilterField>

          <FilterField htmlFor="history-filter-service" label={t("service")}>
            <Input
              id="history-filter-service"
              onChange={(event) => patch({ service: event.target.value })}
              placeholder={t("servicePlaceholder")}
              value={draft.service}
            />
          </FilterField>

          <div className="grid grid-cols-2 gap-3">
            <FilterField htmlFor="history-filter-from" label={t("from")}>
              <Input
                id="history-filter-from"
                onChange={(event) => patch({ from: event.target.value })}
                type="date"
                value={draft.from}
              />
            </FilterField>
            <FilterField htmlFor="history-filter-to" label={t("to")}>
              <Input
                id="history-filter-to"
                onChange={(event) => patch({ to: event.target.value })}
                type="date"
                value={draft.to}
              />
            </FilterField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FilterField htmlFor="history-filter-price-min" label={t("priceMin")}>
              <Input
                id="history-filter-price-min"
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMin: event.target.value })}
                type="number"
                value={draft.priceMin}
              />
            </FilterField>
            <FilterField htmlFor="history-filter-price-max" label={t("priceMax")}>
              <Input
                id="history-filter-price-max"
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMax: event.target.value })}
                type="number"
                value={draft.priceMax}
              />
            </FilterField>
          </div>

          <FilterField htmlFor="history-filter-has-tracking-number" label={t("hasTrackingNumber")}>
            <TriStateSelect
              id="history-filter-has-tracking-number"
              onChange={(value) => patch({ hasTrackingNumber: value })}
              value={draft.hasTrackingNumber}
            />
          </FilterField>

          <FilterField htmlFor="history-filter-has-tracking-url" label={t("hasTrackingUrl")}>
            <TriStateSelect
              id="history-filter-has-tracking-url"
              onChange={(value) => patch({ hasTrackingUrl: value })}
              value={draft.hasTrackingUrl}
            />
          </FilterField>

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

function emptyState(state: DeliveryHistoryQueryState): DeliveryHistoryQueryState {
  return {
    ...state,
    currency: null,
    from: "",
    hasTrackingNumber: null,
    hasTrackingUrl: null,
    priceMax: null,
    priceMin: null,
    service: "",
    store: "",
    to: "",
  };
}

function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </Label>
      {children}
    </div>
  );
}

function toDraft(state: DeliveryHistoryQueryState): FilterDraft {
  return {
    currency: state.currency,
    from: state.from,
    hasTrackingNumber: triFromBoolean(state.hasTrackingNumber),
    hasTrackingUrl: triFromBoolean(state.hasTrackingUrl),
    priceMax: state.priceMax === null ? "" : String(state.priceMax),
    priceMin: state.priceMin === null ? "" : String(state.priceMin),
    service: state.service,
    store: state.store,
    to: state.to,
  };
}

function toPatch(draft: FilterDraft): HistoryFilterPatch {
  const priceMin = Number.parseFloat(draft.priceMin);
  const priceMax = Number.parseFloat(draft.priceMax);

  return {
    currency: draft.currency,
    from: draft.from,
    hasTrackingNumber: triToBoolean(draft.hasTrackingNumber),
    hasTrackingUrl: triToBoolean(draft.hasTrackingUrl),
    priceMax: Number.isNaN(priceMax) ? null : priceMax,
    priceMin: Number.isNaN(priceMin) ? null : priceMin,
    service: draft.service.trim(),
    store: draft.store.trim(),
    to: draft.to,
  };
}

function triFromBoolean(value: Nullable<boolean>): TriState {
  if (value === null) return "any";
  return value ? "yes" : "no";
}

function TriStateSelect({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: TriState) => void;
  value: TriState;
}) {
  const t = useTranslations("delivery.history.filters");

  return (
    <Select onValueChange={(next) => onChange(next as TriState)} value={value}>
      <SelectTrigger className="h-9 w-full" id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">{t("any")}</SelectItem>
        <SelectItem value="yes">{t("yes")}</SelectItem>
        <SelectItem value="no">{t("no")}</SelectItem>
      </SelectContent>
    </Select>
  );
}

function triToBoolean(value: TriState): Nullable<boolean> {
  if (value === "any") return null;
  return value === "yes";
}
