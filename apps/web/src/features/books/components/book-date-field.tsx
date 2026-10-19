"use client";

import type { Nullable } from "@app/shared";

import { addYears, endOfYear, startOfYear, subYears } from "date-fns";

import { DatePicker } from "@/components/ui/date-picker";
import { useWeekStartsOn } from "@/features/settings";
import { dateToIsoDay, isoDayToDate } from "@/lib/iso-day";

const YEAR_SPAN = 10;

type BookDateFieldProps = {
  allowFuture?: boolean;
  ariaLabel: string;
  className?: string;
  describedBy?: string;
  disablePast?: boolean;
  id: string;
  invalid?: boolean;
  onChange: (value: Nullable<string>) => void;
  placeholder?: string;
  required?: boolean;
  value: unknown;
};

export function BookDateField({
  allowFuture = false,
  ariaLabel,
  className,
  describedBy,
  disablePast = false,
  id,
  invalid,
  onChange,
  placeholder,
  required,
  value,
}: BookDateFieldProps) {
  const weekStartsOn = useWeekStartsOn();
  const now = new Date();
  const startMonth = disablePast ? now : startOfYear(subYears(now, YEAR_SPAN));
  const endMonth = allowFuture ? endOfYear(addYears(now, YEAR_SPAN)) : now;

  return (
    <DatePicker
      allowFuture={allowFuture}
      ariaLabel={ariaLabel}
      className={className}
      defaultMonth={now}
      describedBy={describedBy}
      disablePast={disablePast}
      endMonth={endMonth}
      id={id}
      invalid={invalid}
      onChange={(date) => onChange(date ? dateToIsoDay(date) : null)}
      placeholder={placeholder}
      required={required}
      startMonth={startMonth}
      value={typeof value === "string" ? isoDayToDate(value) : undefined}
      weekStartsOn={weekStartsOn}
    />
  );
}
