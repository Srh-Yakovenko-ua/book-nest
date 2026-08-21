"use client";

import type { DeliveryFacetEntry, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import { FilterSection } from "@/components/ui/filter-panel";
import { Input } from "@/components/ui/input";
import { Multiselect } from "@/components/ui/multiselect";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BookDateField } from "@/features/books/components/book-date-field";
import { blockNegativeNumberKeys } from "@/lib/block-negative-number-keys";
import { cn } from "@/lib/utils";

import type { DeliveryHistoryAdvancedState, DeliveryHistoryTab } from "../model/history-params";

import { useHistoryFacets } from "../api/use-history-facets";
import {
  DELIVERY_HISTORY_ADVANCED_EMPTY,
  DELIVERY_HISTORY_CURRENCY_VALUES,
  hasInvalidHistoryRange,
  historyRangeFlags,
} from "../model/history-params";

type DeliveryHistoryAdvancedFiltersProps = {
  activeCount: number;
  onApply: (draft: DeliveryHistoryAdvancedState) => void;
  state: DeliveryHistoryAdvancedState;
  tab: DeliveryHistoryTab;
};

export function DeliveryHistoryAdvancedFilters({
  activeCount,
  onApply,
  state,
  tab,
}: DeliveryHistoryAdvancedFiltersProps) {
  const t = useTranslations("delivery.history.advancedFilters");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DeliveryHistoryAdvancedState>(state);
  const facets = useHistoryFacets({ enabled: open, tab });

  const rangeFlags = historyRangeFlags(draft);
  const priceIsDisabled = draft.currency.length !== 1;
  const isCancelledTab = tab === "cancelled";
  const terminal = isCancelledTab
    ? { from: draft.cancelledFrom, isInverted: rangeFlags.cancelled, to: draft.cancelledTo }
    : { from: draft.receivedFrom, isInverted: rangeFlags.received, to: draft.receivedTo };

  function patch(next: Partial<DeliveryHistoryAdvancedState>) {
    setDraft((prev) => ({ ...prev, ...next }));
  }

  function patchTerminalFrom(value: Nullable<string>) {
    patch(isCancelledTab ? { cancelledFrom: value } : { receivedFrom: value });
  }

  function patchTerminalTo(value: Nullable<string>) {
    patch(isCancelledTab ? { cancelledTo: value } : { receivedTo: value });
  }

  return (
    <Sheet
      onOpenChange={(next) => {
        if (next) setDraft(state);
        setOpen(next);
      }}
      open={open}
    >
      <SheetTrigger asChild>
        <Button
          className={cn("h-10", activeCount > 0 ? "max-sm:px-2.5" : "max-sm:w-10 max-sm:px-0")}
          type="button"
          variant="secondary"
        >
          <UiIcon name="funnel" size={16} />
          <span className="max-sm:sr-only">{t("trigger")}</span>
          {activeCount > 0 ? (
            <Badge className="ml-0.5" variant="secondary">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="gap-0 data-[side=right]:w-full sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <FilterSection title={t("sections.store")}>
            <Multiselect
              emptyText={t("store.empty")}
              onValueChange={(next) => patch({ store: next })}
              options={toOptions(facets.data?.stores, draft.store)}
              placeholder={t("store.placeholder")}
              searchPlaceholder={t("store.search")}
              value={draft.store}
            />
          </FilterSection>

          <FilterSection title={t("sections.orderDate")}>
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={t("orderDate.from")}
                className="h-9 text-sm"
                id="history-filter-ordered-from"
                onChange={(value) => patch({ from: value ?? null })}
                placeholder={t("range.from")}
                value={draft.from}
              />
              <BookDateField
                ariaLabel={t("orderDate.to")}
                className="h-9 text-sm"
                id="history-filter-ordered-to"
                onChange={(value) => patch({ to: value ?? null })}
                placeholder={t("range.to")}
                value={draft.to}
              />
            </div>
            {rangeFlags.ordered ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.booksCount")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("booksCount.min")}
                inputMode="numeric"
                min={0}
                onChange={(event) => patch({ booksMin: parseIntegerValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.booksMin ?? ""}
              />
              <Input
                aria-label={t("booksCount.max")}
                inputMode="numeric"
                min={0}
                onChange={(event) => patch({ booksMax: parseIntegerValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.booksMax ?? ""}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isCancelledTab ? t("booksCount.cancelledHint") : t("booksCount.receivedHint")}
            </p>
            {rangeFlags.books ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection title={t("sections.service")}>
            <Multiselect
              emptyText={t("service.empty")}
              onValueChange={(next) => patch({ service: next })}
              options={toOptions(facets.data?.services, draft.service)}
              placeholder={t("service.placeholder")}
              searchPlaceholder={t("service.search")}
              value={draft.service}
            />
            <p className="text-xs text-muted-foreground">{t("service.hint")}</p>
          </FilterSection>

          <FilterSection title={t("sections.currency")}>
            <ChipGroup
              label={t("sections.currency")}
              mode="multi"
              onValueChange={(next) =>
                patch({
                  currency: DELIVERY_HISTORY_CURRENCY_VALUES.filter((value) =>
                    next.includes(value),
                  ),
                })
              }
              options={DELIVERY_HISTORY_CURRENCY_VALUES.map((value) => ({ label: value, value }))}
              size="sm"
              value={draft.currency}
            />
          </FilterSection>

          <FilterSection title={t("sections.orderTotal")}>
            <div className="grid grid-cols-2 gap-2.5">
              <Input
                aria-label={t("orderTotal.min")}
                disabled={priceIsDisabled}
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMin: parseAmountValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.min")}
                type="number"
                value={draft.priceMin ?? ""}
              />
              <Input
                aria-label={t("orderTotal.max")}
                disabled={priceIsDisabled}
                inputMode="decimal"
                min={0}
                onChange={(event) => patch({ priceMax: parseAmountValue(event.target.value) })}
                onKeyDown={blockNegativeNumberKeys}
                placeholder={t("range.max")}
                type="number"
                value={draft.priceMax ?? ""}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {priceIsDisabled ? t("orderTotal.pickCurrency") : t("orderTotal.hint")}
            </p>
            {rangeFlags.price ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>

          <FilterSection
            title={isCancelledTab ? t("sections.cancelledDate") : t("sections.receivedDate")}
          >
            <div className="grid gap-2.5">
              <BookDateField
                ariaLabel={isCancelledTab ? t("cancelledDate.from") : t("receivedDate.from")}
                className="h-9 text-sm"
                id="history-filter-terminal-from"
                onChange={(value) => patchTerminalFrom(value ?? null)}
                placeholder={t("range.from")}
                value={terminal.from}
              />
              <BookDateField
                ariaLabel={isCancelledTab ? t("cancelledDate.to") : t("receivedDate.to")}
                className="h-9 text-sm"
                id="history-filter-terminal-to"
                onChange={(value) => patchTerminalTo(value ?? null)}
                placeholder={t("range.to")}
                value={terminal.to}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {isCancelledTab ? t("cancelledDate.hint") : t("receivedDate.hint")}
            </p>
            {terminal.isInverted ? (
              <p className="text-xs text-destructive">{t("range.invalid")}</p>
            ) : null}
          </FilterSection>
        </div>

        <SheetFooter className="border-t">
          <Button
            onClick={() => setDraft(DELIVERY_HISTORY_ADVANCED_EMPTY)}
            type="button"
            variant="ghost"
          >
            {t("clear")}
          </Button>
          <Button
            disabled={hasInvalidHistoryRange(draft)}
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
            type="button"
          >
            {t("apply")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function parseAmountValue(raw: string): Nullable<number> {
  if (raw === "") return null;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseIntegerValue(raw: string): Nullable<number> {
  if (raw === "") return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function toOptions(facet: DeliveryFacetEntry[] | undefined, selected: string[]) {
  const names = [...(facet ?? []).map((entry) => entry.name)];
  for (const name of selected) {
    if (!names.includes(name)) names.push(name);
  }
  return names.map((name) => ({ label: name, value: name }));
}
