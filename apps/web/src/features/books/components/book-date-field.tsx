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
  today?: string;
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
  today,
  value,
}: BookDateFieldProps) {
  const weekStartsOn = useWeekStartsOn();
  const todayDate = isoDayToDate(today);
  const referenceDay = todayDate ?? new Date();
  const startMonth = disablePast ? referenceDay : startOfYear(subYears(referenceDay, YEAR_SPAN));
  const endMonth = allowFuture ? endOfYear(addYears(referenceDay, YEAR_SPAN)) : referenceDay;

  return (
    <DatePicker
      allowFuture={allowFuture}
      ariaLabel={ariaLabel}
      className={className}
      defaultMonth={referenceDay}
      describedBy={describedBy}
      earliestDay={disablePast ? referenceDay : undefined}
      endMonth={endMonth}
      id={id}
      invalid={invalid}
      onChange={(date) => onChange(date ? dateToIsoDay(date) : null)}
      placeholder={placeholder}
      required={required}
      startMonth={startMonth}
      today={todayDate}
      value={typeof value === "string" ? isoDayToDate(value) : undefined}
      weekStartsOn={weekStartsOn}
    />
  );
}
