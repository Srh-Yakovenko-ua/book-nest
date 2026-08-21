"use client";

import type { BookBudgetOverview, Currency } from "@app/shared";

import { BOOK_BUDGET_RULES, CurrencySchema, toBudgetMonth } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useUpsertBookBudget } from "../../api/use-book-budgets";

const CURRENCIES: readonly Currency[] = CurrencySchema.options;

type BudgetDraft = Record<Currency, string> & { month: string };

export function StatisticsBudgetDialog({
  onOpenChange,
  open,
  overview,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  overview: BookBudgetOverview | undefined;
}) {
  const t = useTranslations("delivery.statistics.budget.dialog");
  const upsert = useUpsertBookBudget();
  const currentMonth = toBudgetMonth(new Date());
  const [draft, setDraft] = useState<BudgetDraft>(() => toDraft(overview, currentMonth));

  function handleOpenChange(next: boolean) {
    if (next) setDraft(toDraft(overview, currentMonth));
    onOpenChange(next);
  }

  async function save() {
    const entries = CURRENCIES.map((currency) => ({
      currency,
      monthlyAmount: Number(draft[currency]),
      raw: draft[currency].trim(),
    })).filter((entry) => entry.raw !== "" && Number.isFinite(entry.monthlyAmount));

    const invalid = entries.find(
      (entry) =>
        entry.monthlyAmount < BOOK_BUDGET_RULES.monthlyAmountMin ||
        entry.monthlyAmount > BOOK_BUDGET_RULES.monthlyAmountMax,
    );
    if (invalid !== undefined) {
      toast.error(t("invalidAmount", { currency: invalid.currency }));
      return;
    }

    if (entries.length === 0) {
      onOpenChange(false);
      return;
    }

    try {
      for (const entry of entries) {
        await upsert.mutateAsync({
          currency: entry.currency,
          effectiveFromMonth: draft.month,
          monthlyAmount: entry.monthlyAmount,
        });
      }
      toast.success(t("saved"));
      onOpenChange(false);
    } catch {
      toast.error(t("failed"));
    }
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {CURRENCIES.map((currency) => (
            <div className="flex flex-col gap-1.5" key={currency}>
              <Label htmlFor={`budget-${currency}`}>{t("amount", { currency })}</Label>
              <Input
                id={`budget-${currency}`}
                inputMode="decimal"
                min={BOOK_BUDGET_RULES.monthlyAmountMin}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, [currency]: event.target.value }))
                }
                placeholder={t("notConfigured")}
                step="0.01"
                type="number"
                value={draft[currency]}
              />
            </div>
          ))}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="budget-month">{t("effectiveFrom")}</Label>
            <Input
              id="budget-month"
              min={currentMonth.slice(0, 7)}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, month: `${event.target.value}-01` }))
              }
              type="month"
              value={draft.month.slice(0, 7)}
            />
            <p className="text-xs text-muted-foreground">{t("effectiveFromHint")}</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            {t("cancel")}
          </Button>
          <Button disabled={upsert.isPending} onClick={() => void save()}>
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toDraft(overview: BookBudgetOverview | undefined, currentMonth: string): BudgetDraft {
  const amountOf = (currency: Currency): string => {
    const configured = overview?.budgets.find((entry) => entry.currency === currency);
    const amount = configured?.currentMonth?.budget ?? configured?.scheduled?.monthlyAmount;
    return amount === undefined ? "" : String(amount);
  };

  return {
    EUR: amountOf("EUR"),
    month: currentMonth,
    UAH: amountOf("UAH"),
    USD: amountOf("USD"),
  };
}
