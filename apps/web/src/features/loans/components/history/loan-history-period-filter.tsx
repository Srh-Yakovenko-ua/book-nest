"use client";

import { endOfYear, format, isAfter, parseISO, startOfYear, subYears } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookDateField } from "@/features/books/components/book-date-field";
import { ISO_DATE_FORMAT } from "@/features/books/model/reading-progress";
import { cn } from "@/lib/utils";

import type { LoanHistoryPeriod } from "../../model/loan-history-query";

import { formatLoanDate } from "../../model/loans-derive";

type LoanHistoryPeriodFilterProps = {
  className?: string;
  label: string;
  onChange: (period: LoanHistoryPeriod) => void;
  period: LoanHistoryPeriod;
};

type PeriodPreset = "custom" | RangePreset;

type PresetPeriods = Record<RangePreset, LoanHistoryPeriod>;

type RangePreset = "all" | "lastYear" | "thisYear";

const RANGE_PRESETS = ["all", "thisYear", "lastYear"] as const satisfies readonly RangePreset[];

const PERIOD_PRESETS = [...RANGE_PRESETS, "custom"] as const satisfies readonly PeriodPreset[];

const EMPTY_PERIOD: LoanHistoryPeriod = { from: "", to: "" };

export function LoanHistoryPeriodFilter({
  className,
  label,
  onChange,
  period,
}: LoanHistoryPeriodFilterProps) {
  const t = useTranslations("loans.history.period");
  const presets = presetPeriods(new Date());

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LoanHistoryPeriod>(period);
  const [draftPreset, setDraftPreset] = useState<PeriodPreset>(() =>
    resolvePreset(period, presets),
  );

  const isDraftReversed = isReversedRange(draft);

  function triggerLabel(): string {
    const preset = resolvePreset(period, presets);
    if (preset !== "custom") return t(preset);

    const from = formatLoanDate(period.from);
    const to = formatLoanDate(period.to);
    if (from !== null && to !== null) return t("range", { from, to });
    if (from !== null) return `${t("from")} ${from}`;
    if (to !== null) return `${t("to")} ${to}`;
    return t("all");
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setDraft(period);
      setDraftPreset(resolvePreset(period, presets));
    }
    setOpen(next);
  }

  function handlePresetChange(next: string) {
    if (!isPeriodPreset(next)) return;
    setDraftPreset(next);
    if (next === "custom") return;

    setDraft(presets[next]);
    onChange(presets[next]);
    setOpen(false);
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  function reset() {
    setDraft(EMPTY_PERIOD);
    setDraftPreset("all");
    onChange(EMPTY_PERIOD);
    setOpen(false);
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          className={cn("h-10 w-full justify-start gap-2 px-3", className)}
          variant="outline"
        >
          <UiIcon
            aria-hidden
            className="shrink-0 text-muted-foreground"
            name="calendar"
            size={16}
          />
          <span className="min-w-0 truncate">{triggerLabel()}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start">
        <RadioGroup className="gap-1" onValueChange={handlePresetChange} value={draftPreset}>
          {PERIOD_PRESETS.map((preset) => (
            <Label
              className="cursor-pointer gap-3 rounded-md px-2 py-1.5 font-normal text-foreground transition-colors hover:bg-secondary/60 has-data-checked:bg-primary/10 has-data-checked:font-medium has-data-checked:text-ink"
              htmlFor={`loan-history-period-${preset}`}
              key={preset}
            >
              <RadioGroupItem id={`loan-history-period-${preset}`} value={preset} />
              {t(preset)}
            </Label>
          ))}
        </RadioGroup>

        {draftPreset === "custom" ? (
          <div className="flex flex-col gap-2.5 border-t border-border pt-2.5">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="loan-history-period-from">
                {t("from")}
              </Label>
              <BookDateField
                ariaLabel={t("from")}
                className="h-10 text-sm"
                id="loan-history-period-from"
                invalid={isDraftReversed}
                onChange={(next) => setDraft((current) => ({ ...current, from: next ?? "" }))}
                value={draft.from}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="loan-history-period-to">
                {t("to")}
              </Label>
              <BookDateField
                ariaLabel={t("to")}
                className="h-10 text-sm"
                describedBy={isDraftReversed ? "loan-history-period-error" : undefined}
                id="loan-history-period-to"
                invalid={isDraftReversed}
                onChange={(next) => setDraft((current) => ({ ...current, to: next ?? "" }))}
                value={draft.to}
              />
            </div>

            {isDraftReversed ? (
              <p className="text-xs text-destructive" id="loan-history-period-error" role="alert">
                {t("invalidRange")}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <Button onClick={reset} size="sm" variant="ghost">
                {t("reset")}
              </Button>
              <Button disabled={isDraftReversed} onClick={apply} size="sm">
                {t("apply")}
              </Button>
            </div>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function isPeriodPreset(value: string): value is PeriodPreset {
  return PERIOD_PRESETS.some((preset) => preset === value);
}

function isReversedRange({ from, to }: LoanHistoryPeriod): boolean {
  if (from === "" || to === "") return false;
  return isAfter(parseISO(from), parseISO(to));
}

function presetPeriods(reference: Date): PresetPeriods {
  return {
    all: EMPTY_PERIOD,
    lastYear: yearPeriod(subYears(reference, 1)),
    thisYear: yearPeriod(reference),
  };
}

function resolvePreset(period: LoanHistoryPeriod, presets: PresetPeriods): PeriodPreset {
  const match = RANGE_PRESETS.find(
    (preset) => presets[preset].from === period.from && presets[preset].to === period.to,
  );

  return match ?? "custom";
}

function yearPeriod(reference: Date): LoanHistoryPeriod {
  return {
    from: format(startOfYear(reference), ISO_DATE_FORMAT),
    to: format(endOfYear(reference), ISO_DATE_FORMAT),
  };
}
